"use client"

import type React from "react"

import { AuthGuard } from "@/components/auth/auth-guard"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { RouteGuard } from "../auth/route-guard"
import { RouteDebug } from "../debug/route-debug"
import { usePathname } from "next/navigation"

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  
  // Map pathname to resource and action
  const getResourceAndAction = (path: string) => {
    const segments = path.split('/').filter(Boolean)
    
    if (segments.length === 0) {
      return { resource: 'dashboard', action: 'read' }
    }
    
    const resource = segments[0] || 'dashboard'
    let action = 'read'
    
    // Check for action segments in order of specificity
    if (segments.includes('add')) {
      action = 'create'
    } else if (segments.includes('edit')) {
      action = 'update'
    } else if (segments.includes('permissions')) {
      // For role permissions page
      action = 'assign'
    } else if (segments.length > 1 && segments[1] && !['add', 'edit', 'permissions'].includes(segments[1])) {
      // Viewing specific item by ID (e.g., /users/123)
      action = 'read'
    }
    
    return { resource, action }
  }
  
  const { resource, action } = getResourceAndAction(pathname)


  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6 relative lg:pt-6 pt-16">
            <div className="mx-auto">
              <RouteGuard resource={resource} action={action} showErrorPage={true} showToast={true}>
                {children}
              </RouteGuard>
              {/* /<RouteDebug resource={resource} action={action} /> */}
            </div>
          </main>
          <footer className="border-t bg-sidebar/50 p-4 shrink-0">
            <div className="text-xs text-muted-foreground/60 text-center">
              © {new Date().getFullYear()} DIGI ERO PRO CRM
            </div>
          </footer>
        </div>
      </div>
    </AuthGuard>
  )
}