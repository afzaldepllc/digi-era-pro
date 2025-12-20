import { type NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'
import { S3Service } from '@/lib/services/s3-service'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// ============================================
// Validation Schemas
// ============================================

const uploadQuerySchema = z.object({
  channel_id: z.string().uuid(),
  message_id: z.string().uuid().optional()
})

// ============================================
// Helper Functions
// ============================================

function createErrorResponse(message: string, status: number, details?: unknown) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details ? { details } : {})
  }, { status })
}

// ============================================
// POST /api/communication/attachments - Upload file(s) for a channel/message
// ============================================
export async function POST(request: NextRequest) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user } = await genericApiRoutesMiddleware(request, 'communication', 'create')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Parse form data
    const formData = await request.formData()
    const channelId = formData.get('channel_id') as string
    const messageId = formData.get('message_id') as string | null
    const files = formData.getAll('files') as File[]

    if (!channelId) {
      return createErrorResponse('channel_id is required', 400)
    }

    // Validate channel_id
    try {
      uploadQuerySchema.parse({ channel_id: channelId, message_id: messageId || undefined })
    } catch (error) {
      return createErrorResponse('Invalid channel_id or message_id format', 400)
    }

    if (!files || files.length === 0) {
      return createErrorResponse('No files provided', 400)
    }

    if (files.length > 10) {
      return createErrorResponse('Maximum 10 files allowed per upload', 400)
    }

    // Check if user is member of the channel
    const membership = await prisma.channel_members.findFirst({
      where: {
        channel_id: channelId,
        mongo_member_id: session.user.id,
      },
    })

    if (!membership) {
      return createErrorResponse('Access denied to this channel', 403)
    }

    // Upload files to S3 and create attachment records
    const uploadedAttachments = []
    const errors: string[] = []

    for (const file of files) {
      try {
        // Validate file size
        if (file.size > 25 * 1024 * 1024) {
          errors.push(`${file.name}: File too large (max 25MB)`)
          continue
        }

        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer())

        // Upload to S3
        const uploadResult = await S3Service.uploadFile({
          file: buffer,
          fileName: file.name,
          contentType: file.type,
          fileType: 'CHAT_ATTACHMENTS',
          userId: session.user.id,
          metadata: {
            channelId,
            uploadSource: 'chat'
          }
        })

        if (!uploadResult.success || !uploadResult.data) {
          errors.push(`${file.name}: ${uploadResult.error || 'Upload failed'}`)
          continue
        }

        // Create attachment record in Supabase
        // Note: message_id is required in schema, but we'll create a placeholder message if needed
        let actualMessageId = messageId

        // If no message_id provided, we'll store without message linkage initially
        // The message creation will update this later
        if (!actualMessageId) {
          // Create a placeholder - this will be linked when the actual message is created
          // For now, we'll need to handle orphan attachments or require message_id
          return createErrorResponse('message_id is required for attachment upload', 400)
        }

        const attachment = await prisma.attachments.create({
          data: {
            message_id: actualMessageId,
            channel_id: channelId,
            mongo_uploader_id: session.user.id,
            file_name: file.name,
            file_url: uploadResult.data.url,
            s3_key: uploadResult.data.key,
            s3_bucket: process.env.AWS_S3_BUCKET_NAME,
            file_size: uploadResult.data.size,
            file_type: uploadResult.data.contentType
          }
        })

        uploadedAttachments.push({
          id: attachment.id,
          file_name: attachment.file_name,
          file_url: attachment.file_url,
          s3_key: attachment.s3_key,
          file_size: attachment.file_size,
          file_type: attachment.file_type,
          created_at: attachment.created_at.toISOString()
        })
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`${file.name}: ${errorMessage}`)
      }
    }

    // Broadcast attachment upload event via real-time
    if (uploadedAttachments.length > 0) {
      try {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SECRET_KEY!
        )

        const channel = supabaseAdmin.channel(`rt_${channelId}`)
        await channel.send({
          type: 'broadcast',
          event: 'attachments_added',
          payload: {
            channel_id: channelId,
            message_id: messageId,
            attachments: uploadedAttachments
          }
        })
      } catch (broadcastError) {
        console.error('Failed to broadcast attachment event:', broadcastError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        attachments: uploadedAttachments,
        errors: errors.length > 0 ? errors : undefined
      },
      message: errors.length > 0 
        ? `${uploadedAttachments.length} files uploaded, ${errors.length} failed`
        : `${uploadedAttachments.length} files uploaded successfully`
    })

  } catch (error: unknown) {
    console.error('Error uploading attachments:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload attachments'
    return createErrorResponse(errorMessage, 500)
  }
}

// ============================================
// GET /api/communication/attachments?channel_id=... - Get attachments for a channel
// ============================================
export async function GET(request: NextRequest) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'read')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const searchParams = request.nextUrl.searchParams
    const channelId = searchParams.get('channel_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!channelId) {
      return createErrorResponse('channel_id is required', 400)
    }

    // Check if user is member of the channel
    const membership = await prisma.channel_members.findFirst({
      where: {
        channel_id: channelId,
        mongo_member_id: session.user.id,
      },
    })

    if (!membership) {
      return createErrorResponse('Access denied to this channel', 403)
    }

    // Fetch attachments
    const attachments = await prisma.attachments.findMany({
      where: { channel_id: channelId },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
      include: {
        messages: {
          select: {
            sender_name: true
          }
        }
      }
    })

    // Get total count
    const total = await prisma.attachments.count({
      where: { channel_id: channelId }
    })

    // Refresh presigned URLs for attachments
    const enrichedAttachments = await Promise.all(
      attachments.map(async (attachment) => {
        let fileUrl = attachment.file_url

        // Refresh presigned URL if we have an S3 key
        if (attachment.s3_key) {
          try {
            fileUrl = await S3Service.getPresignedUrl(attachment.s3_key, 'CHAT_ATTACHMENTS')
          } catch (error) {
            console.error('Failed to refresh presigned URL for:', attachment.s3_key)
          }
        }

        return {
          id: attachment.id,
          message_id: attachment.message_id,
          file_name: attachment.file_name,
          file_url: fileUrl,
          file_size: attachment.file_size,
          file_type: attachment.file_type,
          uploaded_by: attachment.messages?.sender_name || 'Unknown',
          created_at: attachment.created_at.toISOString()
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: enrichedAttachments,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + attachments.length < total
      }
    })

  } catch (error: unknown) {
    console.error('Error fetching attachments:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch attachments'
    return createErrorResponse(errorMessage, 500)
  }
}
