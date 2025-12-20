"use client"

import { useState, useCallback, memo } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  FileText,
  FileSpreadsheet,
  FileType,
  FileImage,
  FileArchive,
  File,
  Download,
  ExternalLink,
  X,
  Play,
  Maximize2,
  Eye
} from "lucide-react"
import { IAttachment } from "@/types/communication"
import { formatDistanceToNow } from "date-fns"
import Image from "next/image"

interface AttachmentPreviewProps {
  attachment: IAttachment
  className?: string
  size?: "sm" | "md" | "lg"
  showDownload?: boolean
  showPreview?: boolean
}

interface AttachmentGridProps {
  attachments: IAttachment[]
  className?: string
  maxVisible?: number
  onViewAll?: () => void
}

interface AttachmentListItemProps {
  attachment: IAttachment
  uploaderName?: string
  showUploader?: boolean
  className?: string
  onDownload?: (attachment: IAttachment) => void
  onPreview?: (attachment: IAttachment) => void
}

// Helper to determine file category
export function getFileCategory(fileType: string | undefined, fileName: string): 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'spreadsheet' | 'archive' | 'other' {
  const type = fileType?.toLowerCase() || ''
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return 'image'
  }
  if (type.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    return 'video'
  }
  if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext)) {
    return 'audio'
  }
  if (type === 'application/pdf' || ext === 'pdf') {
    return 'pdf'
  }
  if (
    type.includes('word') ||
    type.includes('document') ||
    ['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)
  ) {
    return 'document'
  }
  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    ['xls', 'xlsx', 'csv', 'ods'].includes(ext)
  ) {
    return 'spreadsheet'
  }
  if (
    type.includes('zip') ||
    type.includes('rar') ||
    type.includes('archive') ||
    ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
  ) {
    return 'archive'
  }
  return 'other'
}

// Get icon for file type
export function getFileIcon(category: ReturnType<typeof getFileCategory>) {
  switch (category) {
    case 'image':
      return FileImage
    case 'video':
      return Play
    case 'audio':
      return Play
    case 'pdf':
      return FileText
    case 'document':
      return FileType
    case 'spreadsheet':
      return FileSpreadsheet
    case 'archive':
      return FileArchive
    default:
      return File
  }
}

// Get file extension color
export function getExtensionColor(category: ReturnType<typeof getFileCategory>): string {
  switch (category) {
    case 'image':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'video':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'audio':
      return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
    case 'pdf':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'document':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'spreadsheet':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'archive':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }
}

// Format file size
export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Image preview with lightbox
export const ImagePreview = memo(function ImagePreview({
  src,
  alt,
  className,
  onExpand
}: {
  src: string
  alt: string
  className?: string
  onExpand?: () => void
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className={cn("bg-muted flex items-center justify-center rounded-lg", className)}>
        <FileImage className="h-8 w-8 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "relative rounded-lg overflow-hidden cursor-pointer group",
        className
      )}
      onClick={onExpand}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        className={cn(
          "object-cover transition-opacity duration-200",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
        sizes="(max-width: 768px) 100vw, 300px"
      />
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  )
})

// Single attachment preview (WhatsApp style)
export const AttachmentPreview = memo(function AttachmentPreview({
  attachment,
  className,
  size = "md",
  showDownload = true,
  showPreview = true
}: AttachmentPreviewProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const category = getFileCategory(attachment.file_type, attachment.file_name)
  const Icon = getFileIcon(category)
  const colorClass = getExtensionColor(category)

  const sizeClasses = {
    sm: "max-w-[150px]",
    md: "max-w-[250px]",
    lg: "max-w-[350px]"
  }

  const imageSizes = {
    sm: "h-[100px]",
    md: "h-[180px]",
    lg: "h-[250px]"
  }

  const handleDownload = useCallback(async () => {
    if (!attachment.file_url) return
    setIsDownloading(true)
    try {
      const response = await fetch(attachment.file_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.file_name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setIsDownloading(false)
    }
  }, [attachment.file_url, attachment.file_name])

  // Image attachment
  if (category === 'image' && attachment.file_url) {
    return (
      <>
        <div className={cn("relative rounded-lg overflow-hidden", sizeClasses[size], className)}>
          <ImagePreview
            src={attachment.file_url}
            alt={attachment.file_name}
            className={cn("w-full", imageSizes[size])}
            onExpand={() => setIsLightboxOpen(true)}
          />
          {/* Actions overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs truncate flex-1 mr-2">
                {attachment.file_name}
              </span>
              {showDownload && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload()
                  }}
                  disabled={isDownloading}
                >
                  <Download className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Lightbox */}
        <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
            <DialogTitle className="sr-only">{attachment.file_name}</DialogTitle>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 z-10 h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setIsLightboxOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <Image
                src={attachment.file_url}
                alt={attachment.file_name}
                width={1200}
                height={800}
                className="w-full h-auto max-h-[85vh] object-contain"
              />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <p className="font-medium">{attachment.file_name}</p>
                    <p className="text-sm opacity-80">{formatFileSize(attachment.file_size)}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownload}
                    disabled={isDownloading}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // PDF attachment with preview
  if (category === 'pdf' && attachment.file_url) {
    return (
      <div className={cn(
        "rounded-lg border bg-card overflow-hidden",
        sizeClasses[size],
        className
      )}>
        {/* PDF preview placeholder */}
        <div className={cn(
          "bg-red-50 dark:bg-red-900/20 flex items-center justify-center",
          imageSizes[size]
        )}>
          <div className="text-center">
            <FileText className="h-12 w-12 text-red-500 mx-auto mb-2" />
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">PDF</span>
          </div>
        </div>
        <div className="p-2">
          <p className="text-sm font-medium truncate">{attachment.file_name}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(attachment.file_size)}</p>
          <div className="flex gap-1 mt-2">
            {showPreview && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => window.open(attachment.file_url, '_blank')}
              >
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
            )}
            {showDownload && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                <Download className="h-3 w-3 mr-1" />
                Save
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Generic file attachment
  return (
    <div className={cn(
      "rounded-lg border bg-card p-3 flex items-center gap-3",
      sizeClasses[size],
      className
    )}>
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(attachment.file_size)}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        {showPreview && attachment.file_url && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => window.open(attachment.file_url, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
        {showDownload && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
})

// Grid of attachments (for messages with multiple files)
export const AttachmentGrid = memo(function AttachmentGrid({
  attachments,
  className,
  maxVisible = 4,
  onViewAll
}: AttachmentGridProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<IAttachment | null>(null)
  
  if (!attachments.length) return null

  const visibleAttachments = attachments.slice(0, maxVisible)
  const hiddenCount = attachments.length - maxVisible

  // Single image - full width
  if (attachments.length === 1 && getFileCategory(attachments[0].file_type, attachments[0].file_name) === 'image') {
    return (
      <div className={cn("mt-2", className)}>
        <AttachmentPreview attachment={attachments[0]} size="lg" />
      </div>
    )
  }

  // Multiple images - grid layout
  const allImages = attachments.every(a => getFileCategory(a.file_type, a.file_name) === 'image')
  
  if (allImages) {
    const gridClass = attachments.length === 2 
      ? "grid-cols-2" 
      : attachments.length === 3 
        ? "grid-cols-2" 
        : "grid-cols-2"

    return (
      <div className={cn("mt-2 grid gap-1", gridClass, className)}>
        {visibleAttachments.map((attachment, index) => (
          <div
            key={attachment.id}
            className={cn(
              "relative",
              attachments.length === 3 && index === 0 && "col-span-2"
            )}
          >
            <AttachmentPreview 
              attachment={attachment} 
              size={attachments.length === 3 && index === 0 ? "lg" : "md"}
              className="w-full"
            />
            {/* Show +N overlay on last visible if more hidden */}
            {index === maxVisible - 1 && hiddenCount > 0 && (
              <div 
                className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg cursor-pointer"
                onClick={onViewAll}
              >
                <span className="text-white text-2xl font-semibold">+{hiddenCount}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // Mixed file types - list layout
  return (
    <div className={cn("mt-2 space-y-2", className)}>
      {visibleAttachments.map((attachment) => (
        <AttachmentPreview 
          key={attachment.id} 
          attachment={attachment} 
          size="md"
        />
      ))}
      {hiddenCount > 0 && (
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={onViewAll}
        >
          View {hiddenCount} more file{hiddenCount > 1 ? 's' : ''}
        </Button>
      )}
    </div>
  )
})

// List item for context panel
export const AttachmentListItem = memo(function AttachmentListItem({
  attachment,
  uploaderName,
  showUploader = true,
  className,
  onDownload,
  onPreview
}: AttachmentListItemProps) {
  const category = getFileCategory(attachment.file_type, attachment.file_name)
  const Icon = getFileIcon(category)
  const colorClass = getExtensionColor(category)

  return (
    <div className={cn(
      "flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
      className
    )}>
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatFileSize(attachment.file_size)}</span>
          {showUploader && uploaderName && (
            <>
              <span>•</span>
              <span>{uploaderName}</span>
            </>
          )}
          {attachment.created_at && (
            <>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(attachment.created_at), { addSuffix: true })}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {onPreview && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onPreview(attachment)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        {onDownload && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onDownload(attachment)}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
})

export default AttachmentPreview
