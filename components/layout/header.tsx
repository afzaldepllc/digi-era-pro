"use client"

import { useState } from "react"
import { Bell, Search, Settings, User } from "lucide-react"
import { useSession, signOut } from "next-auth/react"

import { Button } from "@/components/ui/button"
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

  const handleSignOut = () => {
    signOut({ callbackUrl: "/auth/login" })
  }

  return (

    <>
      <header className="flex h-16 items-center justify-between lg:justify-end border-b bg-sidebar/95 backdrop-blur-sm px-4 lg:px-6 shrink-0 sticky top-0 z-30">
        {/* Mobile spacing for menu button */}
        <div className="w-10 lg:hidden" />

        {/* Right side */}
        <div className="flex items-center justify-end space-x-2 lg:space-x-4">
          <ThemeToggle />

          <Button variant="ghost" size="sm" className="relative h-8 w-8 lg:h-9 lg:w-9">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-2 w-2 lg:h-3 lg:w-3 rounded-full bg-red-500" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-[40px] w-[40px]">
                  {session?.user?.image ? (
                    <AvatarImage src={session.user.image} alt={session.user.name || "User"} />
                  ) : (
                    <AvatarFallback className="text-xs hover:bg-primary hover:text-sm hover:font-semibold">
                      {session?.user?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "U"}
                    </AvatarFallback>
                  )}
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none truncate">{session?.user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">{session?.user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsProfileSettingsOpen(true)}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
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