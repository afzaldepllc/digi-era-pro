/**
 * Permission Error Display Component
 * Shows user-friendly error messages when permission is denied
 */

import React from 'react'
import { AlertTriangle, Lock, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

interface PermissionErrorProps {
  title?: string
  message?: string
  resource?: string
  action?: string
  showRetry?: boolean
  showGoHome?: boolean
  onRetry?: () => void
  className?: string
}

export function PermissionError({
  title = "Access Denied",
  message,
  resource,
  action,
  showRetry = true,
  showGoHome = true,
  onRetry,
  className = ""
}: PermissionErrorProps) {
  const router = useRouter()
  
  // Generate contextual message based on resource and action
  const getContextualMessage = () => {
    if (message) return message
    
    if (resource && action) {
      const resourceName = resource.replace(/[-_]/g, ' ').toLowerCase()
      const actionName = action.toLowerCase()
      
      switch (actionName) {
        case 'read':
        case 'view':
          return `You don't have permission to view ${resourceName}.`
        case 'create':
        case 'add':
          return `You don't have permission to create ${resourceName}.`
        case 'update':
        case 'edit':
          return `You don't have permission to edit ${resourceName}.`
        case 'delete':
        case 'remove':
          return `You don't have permission to delete ${resourceName}.`
        case 'manage':
          return `You don't have permission to manage ${resourceName}.`
        default:
          return `You don't have permission to perform this action on ${resourceName}.`
      }
    }
    
    return "You don't have sufficient permissions to access this resource."
  }
  
  const handleGoHome = () => {
    router.push('/dashboard')
  }
  
  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    } else {
      window.location.reload()
    }
  }
  
  return (
    <div className={`flex items-center justify-center min-h-[400px] p-4 ${className}`}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Lock className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            {title}
          </CardTitle>
          <CardDescription className="text-gray-600">
            {getContextualMessage()}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="text-sm text-gray-500">
            Contact your administrator if you believe this is an error.
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {showGoHome && (
              <Button
                onClick={handleGoHome}
                variant="default"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            )}
            
            {showRetry && (
              <Button
                onClick={handleRetry}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Network Error Display Component
 */
interface NetworkErrorProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export function NetworkError({
  title = "Connection Error",
  message = "Unable to connect to the server. Please check your internet connection.",
  onRetry,
  className = ""
}: NetworkErrorProps) {
  return (
    <div className={`flex items-center justify-center min-h-[400px] p-4 ${className}`}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            {title}
          </CardTitle>
          <CardDescription className="text-gray-600">
            {message}
          </CardDescription>
        </CardHeader>
        {onRetry && (
          <CardContent className="text-center">
            <Button
              onClick={onRetry}
              variant="default"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

/**
 * Generic Error Boundary Component
 */
interface ErrorDisplayProps {
  error: any
  resource?: string
  action?: string
  onRetry?: () => void
  className?: string
}

export function ErrorDisplay({
  error,
  resource,
  action,
  onRetry,
  className = ""
}: ErrorDisplayProps) {
  // Determine error type and show appropriate component
  if (error?.statusCode === 403 || error?.code === 'PERMISSION_DENIED') {
    return (
      <PermissionError
        resource={resource}
        action={action}
        message={error.error || error.message}
        onRetry={onRetry}
        className={className}
      />
    )
  }
  
  if (error?.statusCode === 401 || error?.code === 'AUTH_REQUIRED') {
    return (
      <PermissionError
        title="Authentication Required"
        message="Please log in to access this resource."
        showRetry={false}
        onRetry={onRetry}
        className={className}
      />
    )
  }
  
  if (!navigator.onLine || error?.code === 'NETWORK_ERROR') {
    return (
      <NetworkError
        onRetry={onRetry}
        className={className}
      />
    )
  }
  
  // Default error display
  return (
    <div className={`flex items-center justify-center min-h-[400px] p-4 ${className}`}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Something went wrong
          </CardTitle>
          <CardDescription className="text-gray-600">
            {error?.error || error?.message || "An unexpected error occurred."}
          </CardDescription>
        </CardHeader>
        {onRetry && (
          <CardContent className="text-center">
            <Button
              onClick={onRetry}
              variant="default"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}