"use client"

import { useState } from "react"
import { Bell, LogOut, Search, Settings, User } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import { SessionUtils } from "@/lib/utils/session-utils"

import { Button } from "@/components/ui/button"
import { MessageNotification } from "@/components/ui/message-notification"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"

import CustomModal from "@/components/ui/custom-modal"
import { ProfileSettings } from "@/components/profile/profile-setting"

export function Header() {
  const { data: session } = useSession()
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false)
  
  // Type-safe session user access
  const sessionUser = session?.user as any

  const handleSignOut = async () => {
    try {
      // Use comprehensive logout utility
      await SessionUtils.performCompleteLogout('/auth/login')
    } catch (error) {
      console.error('Logout error:', error)
      // Fallback: try NextAuth signOut
      try {
        await signOut({ 
          callbackUrl: "/auth/login",
          redirect: true 
        })
      } catch (signOutError) {
        console.error('NextAuth signOut failed:', signOutError)
        // Force redirect as last resort
        window.location.href = '/auth/login'
      }
    }
  }

  return (

    <>
      <header className="flex h-16 items-center justify-between lg:justify-end border-b bg-sidebar/95 backdrop-blur-sm px-4 lg:px-6 shrink-0 sticky top-0 z-30">
        {/* Mobile spacing for menu button */}
        <div className="w-10 lg:hidden" />

        {/* Right side */}
        <div className="flex items-center justify-end space-x-2 lg:space-x-4">
          <ThemeToggle />

          <MessageNotification className="h-8 w-8 lg:h-9 lg:w-9" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Avatar className="cursor-pointer ">
                    {sessionUser?.avatar ? (
                    <AvatarImage src={sessionUser.avatar} alt={sessionUser.name || "User"} className="object-cover" />
                    ) : (
                    <AvatarFallback className="text-xs hover:bg-primary hover:text-sm hover:font-semibold">
                      {sessionUser?.name
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase() || "U"}
                    </AvatarFallback>
                    )}
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none truncate">{sessionUser?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">{sessionUser?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsProfileSettingsOpen(true)}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>


      </header>
      {/* Profile Modal */}
      <CustomModal
        isOpen={isProfileSettingsOpen}
        onClose={() => setIsProfileSettingsOpen(false)}
        title="My Profile"
        modalSize="xl"
      >
        {isProfileSettingsOpen && <ProfileSettings />}
      </CustomModal>

    </>
  )
}