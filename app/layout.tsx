import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import { cn } from "@/lib/utils"
import { LayoutProvider } from "@/components/layout/layout-provider"

const inter = Inter({
  subsets: ["latin"],
  weight: ['400', '500', '600', '700'],
  variable: "--font-sans",
  display: 'swap',
})

export const metadata: Metadata = {
  title: "DIGI-ERA PRO CRM",
  description: "A DIGI-ERA PRO CRM application",
  generator: 'Next Js',
  icons: {
    icon: '/digi-era-logo.webp',
    shortcut: '/digi-era-logo.webp',
    apple: '/digi-era-logo.webp',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.variable, "font-sans antialiased")} suppressHydrationWarning>
        <Providers>
          <LayoutProvider>
            {children}
          </LayoutProvider>
        </Providers>
      </body>
    </html>
  )
}
