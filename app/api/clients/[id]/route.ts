import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import User from "@/models/User"
import Lead from "@/models/Lead"
import { updateClientSchema, clientIdSchema, clientStatusUpdateSchema } from "@/lib/validations/client"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

interface RouteParams {
  params: { id: string }
}

// GET /api/clients/[id] - Get client by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'clients', 'read')
    
    const validatedParams = clientIdSchema.parse({ id: params.id })
    console.log("clientId18", validatedParams.id);
    // Fetch client with caching
    const client = await executeGenericDbQuery(async () => {
      const foundClient = await User.findOne({
        _id: validatedParams.id,
        // isClient: true   // need to fix later
      })
        .populate('role', 'name permissions')
        .populate('department', 'name')
        .populate('leadId', 'name projectName status createdAt createdBy')
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .lean()
      console.log("foundClient30", foundClient);
      if (!foundClient) {
        throw new Error('Client not found')
      }

      // Check permissions - department-based access control
      if (!isSuperAdmin) {
        const currentUser = await User.findById(user._id).populate('department', 'name')
        const deptName = (currentUser?.department as any)?.name?.toLowerCase()
        
        // Sales and support can see all clients, others may have restrictions
        if (!['sales', 'support'].includes(deptName || '')) {
          // Add department-specific access rules here if needed
          // For now, allow access but you can restrict further based on business rules
        }
      }

      return foundClient
    }, `client-${validatedParams.id}`, 60000) // 1-minute cache

    return NextResponse.json({
      success: true,
      data: client,
      message: 'Client retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error fetching client:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid client ID format',
        details: error.errors
      }, { status: 400 })
    }

    if (error.message === 'Client not found') {
      return NextResponse.json({
        success: false,
        error: 'Client not found'
      }, { status: 404 })
    }

    if (error.message.includes('Access denied')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 403 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch client'
    }, { status: 500 })
  }
}

// PUT /api/clients/[id] - Update client
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'clients', 'update')
    
    const validatedParams = clientIdSchema.parse({ id: params.id })
    const body = await request.json()

    // Check if this is a status update (which has special logic)
    if ((body.clientStatus || body.status) && Object.keys(body).filter(k => k !== 'reason').length <= 2) {
      return await handleClientStatusUpdate(validatedParams.id, body, user, isSuperAdmin || false)
    }

    const validatedData = updateClientSchema.parse(body)

    // Update client with automatic connection management
    const updatedClient = await executeGenericDbQuery(async () => {
      // Find the existing client
      const existingClient = await User.findOne({
        _id: validatedParams.id,
        isClient: true
      })
      
      if (!existingClient) {
        throw new Error('Client not found')
      }

      // Check permissions
      if (!isSuperAdmin) {
        const currentUser = await User.findById(user._id).populate('department', 'name')
        const deptName = (currentUser?.department as any)?.name?.toLowerCase()
        
        // Sales and support can update clients, others may have restrictions
        if (!['sales', 'support'].includes(deptName || '')) {
          throw new Error('Access denied. Only sales and support can update clients.')
        }
      }

      // Handle password update if provided
      if (validatedData.password) {
        // The password will be automatically hashed by the pre-save hook
        existingClient.password = validatedData.password
        existingClient.passwordChangedAt = new Date()
        delete validatedData.password // Remove from direct assignment
      }

      // Update other fields
      Object.assign(existingClient, validatedData)
      
      return await existingClient.save()
    })

    // Clear relevant cache patterns after update
    clearCache('clients')
    clearCache(`client-${validatedParams.id}`)

    // Return updated client with populated fields
    const populatedClient = await executeGenericDbQuery(async () => {
      return await User.findById(updatedClient._id)
        .populate('role', 'name')
        .populate('department', 'name')
        .populate('leadId', 'name projectName status createdAt')
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .lean()
    })

    return NextResponse.json({
      success: true,
      data: populatedClient,
      message: 'Client updated successfully'
    })

  } catch (error: any) {
    console.error('Error updating client:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid client data',
        details: error.errors
      }, { status: 400 })
    }

    if (error.message === 'Client not found') {
      return NextResponse.json({
        success: false,
        error: 'Client not found'
      }, { status: 404 })
    }

    if (error.message.includes('Access denied')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 403 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update client'
    }, { status: 500 })
  }
}

// DELETE /api/clients/[id] - Soft delete client
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'clients', 'delete')
    
    const validatedParams = clientIdSchema.parse({ id: params.id })

    // Soft delete the client (set status to inactive)
    const deletedClient = await executeGenericDbQuery(async () => {
      const existingClient = await User.findOne({
        _id: validatedParams.id,
        isClient: true
      })
      
      if (!existingClient) {
        throw new Error('Client not found')
      }

      // Check permissions
      if (!isSuperAdmin) {
        const currentUser = await User.findById(user._id).populate('department', 'name')
        const deptName = (currentUser?.department as any)?.name?.toLowerCase()
        
        // Only support can delete clients (business rule)
        if (deptName !== 'support') {
          throw new Error('Access denied. Only support department can delete clients.')
        }
      }

      // Cannot delete clients with active projects (you might want to check this)
      // Add project check here when projects module is implemented

      // Soft delete by setting status to inactive
      existingClient.status = 'inactive'
      existingClient.clientStatus = 'unqualified'
      
      return await existingClient.save()
    })

    // Clear relevant cache patterns after deletion
    clearCache('clients')
    clearCache(`client-${validatedParams.id}`)

    return NextResponse.json({
      success: true,
      data: deletedClient,
      message: 'Client deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting client:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid client ID format',
        details: error.errors
      }, { status: 400 })
    }

    if (error.message === 'Client not found') {
      return NextResponse.json({
        success: false,
        error: 'Client not found'
      }, { status: 404 })
    }

    if (error.message.includes('Access denied')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 403 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to delete client'
    }, { status: 500 })
  }
}

// Helper function to handle client status updates with lead synchronization
async function handleClientStatusUpdate(clientId: string, statusData: any, user: any, isSuperAdmin: boolean) {
  try {
    // Build status update object
    const updateData: any = {}
    
    if (statusData.clientStatus) {
      updateData.clientStatus = statusData.clientStatus
    }
    
    if (statusData.status) {
      updateData.status = statusData.status
    }
    
    if (statusData.reason) {
      updateData.reason = statusData.reason
    }

    const validatedStatusData = clientStatusUpdateSchema.parse(updateData)

    const result = await executeGenericDbQuery(async () => {
      const existingClient = await User.findOne({
        _id: clientId,
        isClient: true
      }).populate('leadId')
      
      if (!existingClient) {
        throw new Error('Client not found')
      }

      // Check permissions
      if (!isSuperAdmin) {
        const currentUser = await User.findById(user._id).populate('department', 'name')
        const deptName = (currentUser?.department as any)?.name?.toLowerCase()
        
        if (!['sales', 'support'].includes(deptName || '')) {
          throw new Error('Access denied. Only sales and support can update client status.')
        }
      }

      const originalClientStatus = existingClient.clientStatus

      // Handle unqualification - sync with lead
      if (validatedStatusData.clientStatus === 'unqualified' && originalClientStatus !== 'unqualified') {
        // Update client status
        await existingClient.unqualifyClient(validatedStatusData.reason)

        // Sync with linked lead if exists
        if (existingClient.leadId) {
          const linkedLead = await Lead.findById(existingClient.leadId)
          if (linkedLead && linkedLead.status === 'qualified') {
            linkedLead.status = 'unqualified'
            linkedLead.unqualifiedReason = validatedStatusData.reason || 'Client unqualified'
            linkedLead.unqualifiedAt = new Date()
            await linkedLead.save()

            // TODO: Send notification to sales team about unqualification
            console.log(`Notification: Client ${existingClient.name} unqualified. Reason: ${validatedStatusData.reason}`)
          }
        }
      } else {
        // Regular status update
        if (validatedStatusData.clientStatus) {
          existingClient.clientStatus = validatedStatusData.clientStatus
        }
        if (validatedStatusData.status) {
          existingClient.status = validatedStatusData.status
        }
        
        await existingClient.save()
      }

      // Return client with populated data
      return await User.findById(existingClient._id)
        .populate('role', 'name')
        .populate('department', 'name')
        .populate('leadId', 'name projectName status createdAt')
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .lean()
    })

    // Clear cache
    clearCache('clients')
    clearCache(`client-${clientId}`)
    clearCache('leads') // Also clear leads cache due to sync

    return NextResponse.json({
      success: true,
      data: result,
      message: validatedStatusData.clientStatus === 'unqualified'
        ? 'Client unqualified and lead status synchronized'
        : `Client status updated to ${validatedStatusData.clientStatus || validatedStatusData.status}`,
    })

  } catch (error: any) {
    console.error('Error updating client status:', error)
    throw error // Re-throw to be handled by the main PUT handler
  }
}