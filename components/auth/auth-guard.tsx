"use client"

import type React from "react"
import type { Session } from "next-auth"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: string[]
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (status === "loading") return // Still loading

    if (!session) {
      router.push("/auth/login")
      return
    }

    // Check if role is required and user has the required role
    const userRole = (session?.user as Session["user"])?.role
    if (requiredRole && (!userRole || !requiredRole.includes(userRole))) {
      router.push("/unauthorized")
      return
    }

    // User is authorized
    setIsAuthorized(true)
  }, [session, status, router, requiredRole])

  // Show loading only on initial load, not on every navigation
  if (status === "loading" && !isAuthorized) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="loader" />
      </div>
    )
  }

  if (!session || !isAuthorized) {
    return null
  }

  return <>{children}</>
}
