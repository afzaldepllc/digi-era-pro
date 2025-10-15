import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import Lead from "@/models/Lead"
import User from "@/models/User"
import Role from "@/models/Role"
import Department from "@/models/Department"
import { leadIdSchema } from "@/lib/validations/lead"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

// POST /api/leads/[id]/create-client - Create client from lead
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Security & Authentication - Sales team can create clients from leads
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'clients', 'create')

    // Validate lead ID
    const validatedParams = leadIdSchema.parse({ id: params.id })

    // Create client with automatic connection management
    const result = await executeGenericDbQuery(async () => {
      // 1. Fetch the lead with all required data
      const lead = await Lead.findById(validatedParams.id)
      
      if (!lead) {
        throw new Error('Lead not found')
      }

      // Check if lead can be converted to client
      if (lead.status !== 'active') {
        throw new Error('Only active leads can be converted to clients')
      }

      if (lead.clientId) {
        throw new Error('Lead already has an associated client')
      }

      // 2. Check if client with this email already exists
      const existingClient = await User.findOne({ 
        email: lead.email.toLowerCase(),
        role: { $exists: true }
      }).populate('role')

      if (existingClient) {
        // Check if the existing user is already a client
        const existingRole = await Role.findById(existingClient.role).lean()
        if (
          existingRole &&
          !Array.isArray(existingRole) &&
          existingRole.name.includes('client')
        ) {
          throw new Error('A client with this email already exists')
        }
      }

      // 3. Get client role for sales department
      const salesDepartment = await Department.findOne({ 
        name: 'Sales', 
        status: 'active' 
      })

      if (!salesDepartment) {
        throw new Error('Sales department not found')
      }

      const clientRole = await Role.findOne({ 
        name: `client_${salesDepartment.name.toLowerCase().replace(/\s+/g, '_')}`,
        status: 'active' 
      })

      if (!clientRole) {
        throw new Error('Client role not found for Sales department')
      }

      // 4. Generate a temporary password (user can change it later)
      const tempPassword = Math.random().toString(36).slice(-8) + 'Temp123!'
      const hashedPassword = await bcrypt.hash(tempPassword, 12)

      // 5. Create the client user
      const clientData = {
        name: lead.name,
        email: lead.email.toLowerCase(),
        password: hashedPassword,
        phone: lead.phone || '',
        company: lead.company || undefined,
        role: clientRole._id,
        department: salesDepartment._id,
        leadId: lead._id, // Link back to the lead
        status: 'qualified', // Start as qualified
        emailVerified: false, // Will need to verify email
        phoneVerified: false,
        twoFactorEnabled: false,
        permissions: [],
        preferences: {
          theme: 'system',
          language: 'en',
          timezone: 'UTC',
          notifications: {
            email: true,
            push: false,
            sms: false
          }
        },
        metadata: {
          tags: ['converted_from_lead'],
          createdBy: user.id,
          convertedFromLead: lead._id,
          tempPassword: tempPassword, // Store temporarily for admin reference
        }
      }

      const newClient = new User(clientData)
      await newClient.save()

      // 6. Update the lead status and link to client
      await Lead.findByIdAndUpdate(lead._id, {
        status: 'qualified',
        clientId: newClient._id,
        qualifiedAt: new Date(),
        qualifiedBy: user.id,
      })

      // 7. Populate the client data for response
      const populatedClient = await User.findById(newClient._id)
        .populate('role', 'name displayName')
        .populate('department', 'name displayName')
        .lean()

      return {
        client: {
          ...populatedClient,
          // Don't return the password in the response
          password: undefined,
          tempPassword: tempPassword, // Return temp password for admin reference
        },
        lead: {
          ...lead.toObject(),
          status: 'qualified',
          clientId: newClient._id,
        }
      }
    })

    // Clear relevant caches
    await Promise.all([
      clearCache('leads'),
      clearCache('clients'),
      clearCache(`lead-${validatedParams.id}`)
    ])

    return NextResponse.json({
      success: true,
      message: 'Client created successfully from lead',
      client: result.client,
      lead: result.lead,
    })

  } catch (error: any) {
    console.error('Error creating client from lead:', error)

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to create client from lead' 
      },
      { status: 400 }
    )
  }
}