"use client"

import type React from "react"
import { useEffect } from "react"
import { SessionProvider } from "next-auth/react"
import { Provider } from "react-redux"
import { PersistGate } from "redux-persist/integration/react"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeVariantProvider } from "@/components/theme-variant-provider"
import { ThemeUpdateNotifications } from "@/components/theme-update-notifications"
import { store, persistor } from "@/store"
import { Toaster } from "@/components/ui/toaster"
import { SessionUtils } from "@/lib/utils/session-utils"
import { SocketProvider } from "@/components/providers/socket-provider"

// Session validation component
function SessionValidator({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    console.log('SessionValidator mounted19')
    // Initialize session validation on app start
    SessionUtils.initializeSessionValidation()
  }, [])

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <ThemeVariantProvider>
              <SessionValidator>
                <SocketProvider>
                  {children}
                  <ThemeUpdateNotifications />
                  <Toaster />
                </SocketProvider>
              </SessionValidator>
            </ThemeVariantProvider>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </SessionProvider>
  )
}
