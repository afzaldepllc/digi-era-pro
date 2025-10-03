"use client"

import type React from "react"

import { SessionProvider } from "next-auth/react"
import { Provider } from "react-redux"
import { PersistGate } from "redux-persist/integration/react"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeVariantProvider } from "@/components/theme-variant-provider"
import { store, persistor } from "@/store"
import { Toaster } from "@/components/ui/toaster"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <ThemeVariantProvider>
              {children}
              <Toaster />
            </ThemeVariantProvider>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </SessionProvider>
  )
}
