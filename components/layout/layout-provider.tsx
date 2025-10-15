"use client"

import { usePathname } from "next/navigation"
import type React from "react"
import { AdminLayout } from "./admin-layout"
import { useEffect, useState } from "react"

interface LayoutProviderProps {
    children: React.ReactNode
}

export function LayoutProvider({ children }: LayoutProviderProps) {
    const [mounted, setMounted] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        setMounted(true)
    }, [])

    // Prevent hydration mismatch
    if (!mounted) {
        return (
            <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
                <div className="loader" />
            </div>
        )
    }

    const isAuthRoute = pathname?.startsWith("/auth")

    if (isAuthRoute) {
        return <>{children}</>
    }

    return <AdminLayout>{children}</AdminLayout>
}