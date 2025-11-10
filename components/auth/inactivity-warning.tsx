"use client"

import { useEffect, useState } from 'react'
import { useProfessionalSession } from '@/components/providers/professional-session-provider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Clock, AlertTriangle } from 'lucide-react'

export function InactivityWarning() {
  const { timeUntilExpiry, extendSession } = useProfessionalSession()
  const [showWarning, setShowWarning] = useState(false)

  // Show warning when less than 30 seconds remaining
  const WARNING_THRESHOLD = 30 * 1000 // 30 seconds

  useEffect(() => {
    setShowWarning(timeUntilExpiry > 0 && timeUntilExpiry <= WARNING_THRESHOLD)
  }, [timeUntilExpiry])

  if (!showWarning) return null

  const secondsRemaining = Math.ceil(timeUntilExpiry / 1000)

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Alert className="border-warning bg-warning/10">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="font-medium">
              Session expires in {secondsRemaining} seconds
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            You will be automatically logged out due to inactivity.
          </div>
          <Button 
            size="sm" 
            onClick={extendSession}
            className="w-full"
          >
            Stay Logged In
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}