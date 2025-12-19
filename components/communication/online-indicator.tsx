"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { IParticipant } from "@/types/communication"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface OnlineIndicatorProps {
  users: IParticipant[]
  maxVisible?: number
  showNames?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

export function OnlineIndicator({
  users,
  maxVisible = 5,
  showNames = false,
  size = "md",
  className
}: OnlineIndicatorProps) {
  const onlineUsers = users.filter(user => user.isOnline)
  const visibleUsers = onlineUsers.slice(0, maxVisible)
  const remainingCount = onlineUsers.length - visibleUsers.length

  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10"
  }

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  }

  if (onlineUsers.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", textSizeClasses[size], className)}>
        <div className="h-2 w-2 rounded-full bg-gray-400" />
        <span>No one online</span>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        {/* Online indicator dot */}
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className={cn("text-muted-foreground", textSizeClasses[size])}>
            {onlineUsers.length} online
          </span>
        </div>

        {/* User avatars */}
        <div className="flex -space-x-2">
          {visibleUsers.map((user) => (
            <Tooltip key={user.mongo_member_id}>
              <TooltipTrigger>
                <div className="relative">
                  <Avatar className={cn(sizeClasses[size], "border-2 border-background")}>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className={textSizeClasses[size]}>
                      {user.name
                        ? (() => {
                          const parts = user.name.trim().split(' ');
                          if (parts.length === 1) {
                            return parts[0][0].toUpperCase();
                          }
                          return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                        })()
                        : ''}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online dot */}
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-medium">{user.name}</p>
                  {user.role && (
                    <p className="text-xs text-muted-foreground">{user.role}</p>
                  )}
                  <Badge variant="outline" className="text-xs mt-1">
                    {user.userType}
                  </Badge>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}

          {remainingCount > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <div className={cn(
                  "flex items-center justify-center rounded-full bg-muted border-2 border-background",
                  sizeClasses[size]
                )}>
                  <span className={cn("font-medium text-muted-foreground", textSizeClasses[size])}>
                    +{remainingCount}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  {onlineUsers.slice(maxVisible).map(user => (
                    <div key={user.mongo_member_id} className="text-sm">
                      {user.name}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Names list (optional) */}
        {showNames && (
          <div className="flex flex-wrap gap-1">
            {visibleUsers.map((user, index) => (
              <span key={user.mongo_member_id} className={cn("text-muted-foreground", textSizeClasses[size])}>
                {user.name}
                {index < visibleUsers.length - 1 && ", "}
              </span>
            ))}
            {remainingCount > 0 && (
              <span className={cn("text-muted-foreground", textSizeClasses[size])}>
                and {remainingCount} more
              </span>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}