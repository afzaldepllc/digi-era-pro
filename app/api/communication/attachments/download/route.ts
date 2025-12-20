import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { S3Service } from '@/lib/services/s3-service'

// GET /api/communication/attachments/download?id=xxx
// Returns a fresh presigned download URL for an attachment
export async function GET(request: NextRequest) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'read')
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('id')

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID is required' }, { status: 400 })
    }

    // Fetch the attachment
    const attachment = await prisma.attachments.findUnique({
      where: { id: attachmentId },
      include: {
        channels: true
      }
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Verify user has access to the channel
    if (attachment.channel_id) {
      const membership = await prisma.channel_members.findFirst({
        where: {
          channel_id: attachment.channel_id,
          mongo_member_id: session.user.id
        }
      })

      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Generate fresh download URL with Content-Disposition header
    if (!attachment.s3_key) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
    }

    const downloadUrl = await S3Service.getPresignedDownloadUrl(
      attachment.s3_key,
      'CHAT_ATTACHMENTS',
      attachment.file_name
    )

    return NextResponse.json({
      success: true,
      downloadUrl,
      fileName: attachment.file_name,
      fileType: attachment.file_type,
      fileSize: attachment.file_size
    })
  } catch (error) {
    console.error('Error generating download URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    )
  }
}
