import { type NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'
import { messageOperations } from '@/lib/db-utils'
import { updateMessageSchema, messageIdSchema } from "@/lib/validations/channel"
import { SecurityUtils } from '@/lib/security/validation'
import { getClientInfo } from '@/lib/security/error-handler'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { createAPIErrorResponse } from "@/lib/utils/api-responses"


// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// PUT /api/communication/messages/[messageId] - Update message
export async function PUT(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'update')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Validate message ID
    const validatedParams = messageIdSchema.parse(params)

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateMessageSchema.parse(body)

    // Check if user owns the message
    const message = await prisma.messages.findUnique({
      where: { id: validatedParams.messageId },
    })

    if (!message) {
      return createErrorResponse('Message not found', 404)
    }

    if (message.mongo_sender_id !== session.user.id && !isSuperAdmin) {
      return createErrorResponse('Access denied - you can only edit your own messages', 403)
    }

    // Update message using messageOperations
    const updatedMessage = await messageOperations.update(validatedParams.messageId, validatedData.content)

    return NextResponse.json({
      success: true,
      data: updatedMessage,
      message: 'Message updated successfully'
    })
  } catch (error: any) {
    console.error('Error updating message:', error)
    return createAPIErrorResponse(error, 'Failed to update message', getClientInfo(request))
  }
}

// DELETE /api/communication/messages/[messageId] - Delete message
export async function DELETE(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'delete')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Validate message ID
    const validatedParams = messageIdSchema.parse(params)

    // Check if user owns the message
    const message = await prisma.messages.findUnique({
      where: { id: validatedParams.messageId },
    })

    if (!message) {
      return createErrorResponse('Message not found', 404)
    }

    if (message.mongo_sender_id !== session.user.id && !isSuperAdmin) {
      return createErrorResponse('Access denied - you can only delete your own messages', 403)
    }

    // Delete message using messageOperations (handles reply_count decrement)
    await messageOperations.delete(validatedParams.messageId)

    return NextResponse.json({
      success: true,
      message: 'Message deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting message:', error)
    return createAPIErrorResponse(error, 'Failed to delete message', getClientInfo(request))
  }
}
