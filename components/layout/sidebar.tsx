"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { usePermissions } from "@/hooks/use-permissions"
import {
  Home,
  Users2,
  Building2,
  Briefcase,
  Target,
  BarChart3,
  Mail,
  FolderOpen,
  Calendar,
  FileText,
  Network,
  Shield,
  Eye,
  UserPlus,
  UserCheck,
  Plus,
  Building,
  TrendingUp,
  Send,
  Folder,
  FileCheck,
  Lock,
  Activity,
  ChevronLeft,
  ChevronDown,
  Menu,
  X,
  Settings as SettingsIcon
} from "lucide-react"

type MenuSubItem = {
  title: string
  href: string
  icon: React.ElementType
  allowedResource?: string
  allowedActions?: string[]
}

type MenuItem = {
  title: string
  href: string
  icon: React.ElementType
  badge: null | string
  subItems?: MenuSubItem[]
  allowedResource?: string
  allowedActions?: string[]
}

type MenuSection = {
  title: string
  items: MenuItem[]
}

const menuItems: MenuSection[] = [
  {
    title: "MAIN MENU",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: Home,
        badge: null,
        allowedResource: "dashboard",
        allowedActions: ["read"],
      },
    ],
  },
  {
    title: "CRM",
    items: [
      {
        title: "Users",
        href: "/users",
        icon: Users2,
        badge: null,
        allowedResource: "users",
        allowedActions: ["read"],
        subItems: [
          {
            title: "All Users",
            href: "/users",
            icon: Eye,
            allowedResource: "users",
            allowedActions: ["read"],
          },
          {
            title: "Add User",
            href: "/users/add",
            icon: UserPlus,
            allowedResource: "users",
            allowedActions: ["create"],
          },
        ],
      },
      {
        title: "Departments",
        href: "/departments",
        icon: Building,
        badge: null,
        allowedResource: "departments",
        allowedActions: ["read"],
        subItems: [
          {
            title: "All Departments",
            href: "/departments",
            icon: Eye,
            allowedResource: "departments",
            allowedActions: ["read"],
          },
          {
            title: "Add Department",
            href: "/departments/add",
            icon: Plus,
            allowedResource: "departments",
            allowedActions: ["create"],
          },
        ],
      },
      {
        title: "Roles & Permissions",
        href: "/roles",
        icon: Lock,
        badge: null,
        allowedResource: "roles",
        allowedActions: ["read"],
        subItems: [
          {
            title: "All Roles",
            href: "/roles",
            icon: Eye,
            allowedResource: "roles",
            allowedActions: ["read"],
          },
          {
            title: "Add Role",
            href: "/roles/add",
            icon: Plus,
            allowedResource: "roles",
            allowedActions: ["create"],
          },
        ],
      },
      {
        title: "Leads",
        href: "/leads",
        icon: Target,
        badge: null,
        allowedResource: "leads",
        allowedActions: ["read"],
        subItems: [
          {
            title: "All Leads",
            href: "/leads",
            icon: Eye,
            allowedResource: "leads",
            allowedActions: ["read"],
          },
          {
            title: "Add Lead",
            href: "/leads/add",
            icon: Plus,
            allowedResource: "leads",
            allowedActions: ["create"],
          },
          {
            title: "Lead Sources",
            href: "/leads/sources",
            icon: Target,
            allowedResource: "leads",
            allowedActions: ["read"],
          },
        ],
      },

      {
        title: "Projects",
        href: "/projects",
        icon: FolderOpen,
        badge: null,
        allowedResource: "projects",
        allowedActions: ["read"],
        subItems: [
          {
            title: "All Projects",
            href: "/projects",
            icon: Eye,
            allowedResource: "projects",
            allowedActions: ["read"],
          },
          {
            title: "Create Project",
            href: "/projects/add",
            icon: Plus,
            allowedResource: "projects",
            allowedActions: ["create"],
          },
          {
            title: "Project Templates",
            href: "/projects/templates",
            icon: Folder,
            allowedResource: "projects",
            allowedActions: ["read"],
          },
        ],
      },
      {
        title: "Tasks",
        href: "/tasks",
        icon: Calendar,
        badge: null,
        allowedResource: "tasks",
        allowedActions: ["read"],
        subItems: [
          {
            title: "All Tasks",
            href: "/tasks",
            icon: Eye,
            allowedResource: "tasks",
            allowedActions: ["read"],
          },
          {
            title: "Create Task",
            href: "/tasks/create",
            icon: Plus,
            allowedResource: "tasks",
            allowedActions: ["create"],
          },
          {
            title: "Task Calendar",
            href: "/tasks/calendar",
            icon: Calendar,
            allowedResource: "tasks",
            allowedActions: ["read"],
          },
        ],
      },
      {
        title: "Proposals",
        href: "/proposals",
        icon: FileText,
        badge: null,
        allowedResource: "proposals",
        allowedActions: ["read"],
        subItems: [
          {
            title: "All Proposals",
            href: "/proposals",
            icon: Eye,
            allowedResource: "proposals",
            allowedActions: ["read"],
          },
          {
            title: "Create Proposal",
            href: "/proposals/create",
            icon: Plus,
            allowedResource: "proposals",
            allowedActions: ["create"],
          },
          {
            title: "Proposal Templates",
            href: "/proposals/templates",
            icon: FileCheck,
            allowedResource: "proposals",
            allowedActions: ["read"],
          },
        ],
      },
      {
        title: "HRM",
        href: '/departments',
        icon: Network,
        badge: null,
        allowedResource: "departments",
        allowedActions: ["read"],
        subItems: [
          {
            title: "All Departments",
            href: '/departments',
            icon: Eye,
            allowedResource: "departments",
            allowedActions: ["read"],
          },
          {
            title: "Add Department",
            href: '/departments/add',
            icon: Plus,
            allowedResource: "departments",
            allowedActions: ["create"],
          },
        ]
      },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      {
        title: "Settings",
        href: "/settings",
        icon: SettingsIcon,
        badge: null,
        allowedResource: "settings",
        allowedActions: ["read"],
      },
    ],
  },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const pathname = usePathname()

  // Get permissions
  const { canAccess, loading: permissionsLoading } = usePermissions()

  // Helper function to check if user can access a menu item
  const canAccessItem = (item: MenuItem | MenuSubItem): boolean => {
    if (!item.allowedResource || !item.allowedActions) {
      return true // Show items without allowedResource/allowedActions requirements
    }
    return canAccess(item.allowedResource, item.allowedActions)
  }

  // Helper function to check if any sub-items are accessible
  const hasAccessibleSubItems = (subItems?: MenuSubItem[]): boolean => {
    if (!subItems) return false
    return subItems.some(subItem => canAccessItem(subItem))
  }

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024
      if (isMobile) {
        setCollapsed(false) // On mobile, always show full sidebar when open
        setMobileOpen(false) // Close mobile sidebar on resize
      } else {
        setCollapsed(window.innerWidth < 1280) // Auto-collapse on medium screens
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Close mobile sidebar when route changes
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileOpen])

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev =>
      prev.includes(title)
        ? prev.filter(item => item !== title)
        : [...prev, title]
    )
  }

  const isItemExpanded = (title: string) => expandedItems.includes(title)

  const toggleMobileSidebar = () => {
    setMobileOpen(!mobileOpen)
  }

  const toggleCollapsed = () => {
    setCollapsed(!collapsed)
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleMobileSidebar}
        className="fixed top-4 left-4 z-50 lg:hidden h-9 w-9 p-0 bg-background/80 backdrop-blur-sm border shadow-sm"
      >
        {mobileOpen ? (
          <X className="h-4 w-4" />
        ) : (
          <Menu className="h-4 w-4" />
        )}
      </Button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - Sticky positioning */}
      <div
        className={cn(
          "flex flex-col border-r bg-sidebar/95 backdrop-blur-sm transition-all duration-300 ease-in-out",
          // Desktop: sticky positioning for always visible during scroll
          "lg:sticky lg:top-0 lg:h-screen lg:max-h-screen",
          // Mobile: fixed positioning for overlay
          "fixed z-50 h-screen max-h-screen lg:z-auto",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          // Width based on collapsed state
          collapsed ? "w-16" : "w-72",
          // Mobile always full width when open
          "lg:w-auto w-72",
          className,
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b bg-sidebar/98 backdrop-blur-sm px-4 shrink-0">
          {!collapsed && (
            <div className="flex items-center space-x-3 min-w-0">
              <div className="flex h-9 w-12 items-center justify-center shrink-0 overflow-hidden">
                <Image
                  src="/digi-era-logo.webp"
                  width={80}
                  height={80}
                  alt="Logo"
                  className="object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold tracking-tight text-sidebar-foreground truncate">
                  DIGI ERA PRO
                </div>
                <div className="text-xs text-muted-foreground/70 font-medium truncate">
                  Customer Relations
                </div>
              </div>
            </div>
          )}

          {/* Desktop toggle button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            className="h-9 w-9 p-0 hover:bg-primary transition-all duration-200 hidden lg:flex shrink-0"
          >
            <ChevronLeft className={cn(
              "h-4 w-4 transition-transform duration-300",
              collapsed && "rotate-180"
            )} />
          </Button>

          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(false)}
            className="h-9 w-9 p-0 hover:bg-primary transition-all duration-200 lg:hidden shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          {permissionsLoading ? (
            <div className="space-y-2">
              {/* Loading skeleton */}
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center space-x-3 px-3 py-2.5">
                  <div className="h-8 w-8 bg-sidebar-accent/20 rounded-lg animate-pulse" />
                  {!collapsed && (
                    <div className="flex-1 space-y-1">
                      <div className="h-4 bg-sidebar-accent/20 rounded animate-pulse" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <nav className="space-y-6">
              {menuItems.map((section, sectionIndex) => {
                // Filter items based on permissions
                const accessibleItems = section.items.filter(item =>
                  canAccessItem(item) || hasAccessibleSubItems(item.subItems)
                )

                // Skip section if no accessible items
                if (accessibleItems.length === 0) return null

                return (
                  <div key={sectionIndex} className="space-y-2">
                    {!collapsed && (
                      <div className="flex items-center px-3 pb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 truncate">
                          {section.title}
                        </h3>
                        <div className="ml-3 flex-1 border-t border-sidebar-border/40" />
                      </div>
                    )}

                    <div className="space-y-1">
                      {accessibleItems.map((item, itemIndex) => {
                        const isActive = pathname === item.href ||
                          (item.subItems && item.subItems.some(subItem => pathname === subItem.href))
                        const isExpanded = isItemExpanded(item.title)

                        // Filter accessible sub-items
                        const accessibleSubItems = item.subItems?.filter(subItem => canAccessItem(subItem))
                        const hasSubItems = accessibleSubItems && accessibleSubItems.length > 0

                        return (
                          <div key={itemIndex}>
                            {hasSubItems && !collapsed ? (
                              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(item.title)}>
                                <CollapsibleTrigger asChild>
                                  <div
                                    className={cn(
                                      "group flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer",
                                      "hover:bg-gradient-to-r hover:from-sidebar-accent hover:to-sidebar-accent/50 hover:shadow-sm",
                                      isActive
                                        ? "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/60 text-sidebar-accent-foreground shadow-md font-semibold"
                                        : "text-sidebar-foreground hover:text-sidebar-accent-foreground",
                                    )}
                                  >
                                    <div className={cn(
                                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors mr-3 shrink-0",
                                      isActive
                                        ? "bg-primary/15 text-primary"
                                        : "bg-sidebar-accent/20 text-sidebar-foreground/70 group-hover:bg-sidebar-accent/40 group-hover:text-sidebar-foreground"
                                    )}>
                                      <item.icon className="h-4 w-4" />
                                    </div>
                                    <span className="flex-1 text-left tracking-wide truncate min-w-0">
                                      {item.title}
                                    </span>
                                    {item.badge && (
                                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                                        {item.badge}
                                      </span>
                                    )}
                                    <ChevronDown className={cn(
                                      "ml-2 h-4 w-4 transition-transform duration-200 shrink-0",
                                      isExpanded && "rotate-180"
                                    )} />
                                  </div>
                                </CollapsibleTrigger>

                                <CollapsibleContent className="space-y-0">
                                  <div className="mt-2 ml-5 space-y-1">
                                    {accessibleSubItems?.map((subItem, subIndex) => {
                                      const isSubActive = pathname === subItem.href
                                      return (
                                        <Link key={subIndex} href={subItem.href}>
                                          <div
                                            className={cn(
                                              "group flex items-center rounded-md px-3 py-2 text-sm transition-all duration-200",
                                              "hover:bg-sidebar-accent/30 hover:text-sidebar-accent-foreground",
                                              isSubActive
                                                ? "bg-primary text-white font-medium text-base hover:bg-primary-80 hover:text-primary-foreground"
                                                : "text-sidebar-foreground/80 hover:text-sidebar-foreground",
                                            )}
                                          >
                                            <div className={cn(
                                              "flex h-6 w-6 items-center justify-center rounded-md transition-colors mr-3 shrink-0",
                                              isSubActive
                                                ? "bg-primary/20 text-white"
                                                : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
                                            )}>
                                              <subItem.icon className="h-3.5 w-3.5" />
                                            </div>
                                            <span className="tracking-wide truncate min-w-0">
                                              {subItem.title}
                                            </span>
                                          </div>
                                        </Link>
                                      )
                                    })}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            ) : (
                              canAccessItem(item) && (
                                <Link href={item.href}>
                                  <div
                                    className={cn(
                                      "group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                      "hover:bg-gradient-to-r hover:from-sidebar-accent hover:to-sidebar-accent/50 hover:shadow-sm",
                                      isActive
                                        ? "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/60 text-sidebar-accent-foreground shadow-md font-semibold"
                                        : "text-sidebar-foreground hover:text-sidebar-accent-foreground",
                                      collapsed && "justify-center px-2",
                                    )}
                                  >
                                    <div className={cn(
                                      "flex items-center justify-center rounded-lg transition-colors shrink-0",
                                      collapsed ? "h-8 w-8" : "h-8 w-8 mr-3",
                                      isActive
                                        ? "bg-primary/15 text-primary"
                                        : "bg-sidebar-accent/20 text-sidebar-foreground/70 group-hover:bg-sidebar-accent/40 group-hover:text-sidebar-foreground"
                                    )}>
                                      <item.icon className="h-4 w-4" />
                                    </div>
                                    {!collapsed && (
                                      <div className="flex flex-1 items-center justify-between min-w-0">
                                        <span className="tracking-wide truncate">
                                          {item.title}
                                        </span>
                                        {item.badge && (
                                          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                                            {item.badge}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </Link>
                              )
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </nav>
          )}
        </ScrollArea>
      </div>
    </>
  )
}