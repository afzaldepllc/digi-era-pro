'use client'
import { useLayoutEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  console.log('from home page')
  const router = useRouter()

  useLayoutEffect(() => {
    router.replace("/dashboard") // replace avoids adding to history
  }, [router])

  return null // or empty fragment, no flicker
}
