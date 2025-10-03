/**
 * Frontend API Error Handling Utility
 * Provides consistent error handling and user-friendly messages
 */

import { toast } from "@/hooks/use-toast"

export interface APIError {
  success: false
  error: string
  code?: string
  details?: any
  timestamp: string
  statusCode: number
}

export interface APISuccess<T = any> {
  success: true
  data: T
  message?: string
  timestamp: string
}

/**
 * Check if a response is an API error
 */
export function isAPIError(response: any): response is APIError {
  return response && typeof response === 'object' && response.success === false
}

/**
 * Extract user-friendly error message from API response
 */
export function getErrorMessage(error: any): string {
  // If it's an API error response
  if (isAPIError(error)) {
    return error.error
  }

  // If it's a Response object
  if (error instanceof Response) {
    switch (error.status) {
      case 401:
        return "You need to log in to access this resource."
      case 403:
        return "You don't have permission to perform this action."
      case 404:
        return "The requested resource was not found."
      case 429:
        return "Too many requests. Please try again later."
      case 500:
        return "A server error occurred. Please try again later."
      default:
        return "An error occurred while processing your request."
    }
  }

  // If it's an Error object
  if (error instanceof Error) {
    return error.message
  }

  // If it's a string
  if (typeof error === 'string') {
    return error
  }

  // If it has an error property
  if (error && error.error) {
    return error.error
  }

  // Default fallback
  return "An unexpected error occurred."
}

/**
 * Handle API errors with user-friendly toasts
 */
export function handleAPIError(error: any, defaultMessage?: string) {
  const message = defaultMessage || getErrorMessage(error)

  // Determine toast variant based on error type
  let variant: "default" | "destructive" = "destructive"

  if (isAPIError(error)) {
    switch (error.code) {
      case "AUTH_REQUIRED":
      case "SESSION_EXPIRED":
        variant = "default"
        break
      case "PERMISSION_DENIED":
      case "INSUFFICIENT_PERMISSIONS":
        variant = "destructive"
        break
      default:
        variant = "destructive"
    }
  }

  toast({
    title: "Error",
    description: message,
    variant,
  })

  // Log error for debugging
  console.error('API Error:', error)
}

/**
 * Handle API success with optional toast
 */
export function handleAPISuccess<T>(response: APISuccess<T>, showToast = false) {
  if (showToast && response.message) {
    toast({
      title: "Success",
      description: response.message,
      variant: "default",
    })
  }

  return response.data
}

/**
 * Generic API fetch wrapper with error handling
 */
export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {},
  showErrorToast = true
): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    const data = await response.json()

    // Handle API error responses
    if (!response.ok || isAPIError(data)) {
      const error = isAPIError(data) ? data : {
        statusCode: response.status,
        error: data.message || response.statusText || 'Request failed',
        success: false as const,
        timestamp: new Date().toISOString()
      }

      if (showErrorToast) {
        handleAPIError(error)
      }

      throw error
    }

    // Return the data for successful responses
    return data.success ? data.data : data

  } catch (error: any) {
    if (showErrorToast && !error.statusCode) {
      // Only show toast for network errors, not API errors (they're already handled above)
      handleAPIError(error, "Network error. Please check your connection.")
    }

    throw error
  }
}

/**
 * Permission-specific error messages
 */
export const PermissionMessages = {
  DASHBOARD: "You don't have permission to access the dashboard.",
  USERS: "You don't have permission to manage users.",
  ROLES: "You don't have permission to manage roles.",
  DEPARTMENTS: "You don't have permission to manage departments.",
  SYSTEM_PERMISSIONS: "You don't have permission to manage system permissions.",
  REPORTS: "You don't have permission to view reports.",
  SETTINGS: "You don't have permission to access settings.",

  READ: (resource: string) => `You don't have permission to view ${resource}.`,
  CREATE: (resource: string) => `You don't have permission to create ${resource}.`,
  UPDATE: (resource: string) => `You don't have permission to update ${resource}.`,
  DELETE: (resource: string) => `You don't have permission to delete ${resource}.`,
  MANAGE: (resource: string) => `You don't have permission to manage ${resource}.`,
}

/**
 * Custom hooks for API requests with error handling
 */
export function useAPIRequest() {
  const request = async <T = any>(
    url: string,
    options: RequestInit = {},
    showErrorToast = true
  ): Promise<T> => {
    return apiRequest<T>(url, options, showErrorToast)
  }

  const get = async <T = any>(url: string, showErrorToast = true): Promise<T> => {
    return request<T>(url, { method: 'GET' }, showErrorToast)
  }

  const post = async <T = any>(url: string, data: any, showErrorToast = true): Promise<T> => {
    return request<T>(url, {
      method: 'POST',
      body: JSON.stringify(data),
    }, showErrorToast)
  }

  const put = async <T = any>(
    url: string,
    data: any,
    showErrorToast = true
  ): Promise<T> => {
    return request<T>(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, showErrorToast)
  }

  const del = async <T = any>(url: string, showErrorToast = true): Promise<T> => {
    return request<T>(url, { method: 'DELETE' }, showErrorToast)
  }

  return { request, get, post, put, delete: del }
}