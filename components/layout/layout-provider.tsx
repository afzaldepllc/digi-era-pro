"use client"

import { usePathname } from "next/navigation"
import type React from "react"
import { AdminLayout } from "./admin-layout"

interface LayoutProviderProps {
    children: React.ReactNode
}

export function LayoutProvider({ children }: LayoutProviderProps) {
    const pathname = usePathname()
    const isAuthRoute = pathname?.startsWith("/auth")

    if (isAuthRoute) {
        return <>{children}</>
    }

    return <AdminLayout>{children}</AdminLayout>
}