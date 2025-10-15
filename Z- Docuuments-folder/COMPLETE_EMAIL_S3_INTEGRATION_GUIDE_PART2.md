# Complete AWS SES & S3 Integration Guide - Part 2
## API Layer, State Management, Frontend Integration & Testing

This is the continuation of the integration guide covering the remaining phases.

---

## 🌐 **PHASE 5: API Layer**

### Step 5.1: Email API Routes

Create `app/api/email/route.ts`:
```typescript
import { type NextRequest, NextResponse } from "next/server"
import { EmailService } from '@/lib/services/email-service'
import { sendEmailSchema, emailQuerySchema } from '@/lib/validations/email'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { z } from 'zod'

// POST /api/email - Send email
export async function POST(request: NextRequest) {
  try {
    // Security & Authentication
    const { session, user } = await genericApiRoutesMiddleware(request, 'email', 'create')

    // Parse & validate request body
    const body = await request.json()
    const validatedData = sendEmailSchema.parse(body)

    // Send email via service
    const result = await EmailService.sendEmail({
      ...validatedData,
      userId: user.id
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        messageId: result.messageId,
        emailLogId: result.emailLogId
      },
      message: 'Email sent successfully'
    }, { status: 201 })

  } catch (error: any) {
    console.error('Email send error:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to send email'
    }, { status: 500 })
  }
}

// GET /api/email - Get email analytics and logs
export async function GET(request: NextRequest) {
  try {
    // Security & Authentication
    const { session, user } = await genericApiRoutesMiddleware(request, 'email', 'read')
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || '',
      category: searchParams.get('category') || '',
      status: searchParams.get('status') || '',
      userId: searchParams.get('userId') || user.id,
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    }

    const validatedParams = emailQuerySchema.parse(queryParams)

    // Get analytics from service
    const analytics = await EmailService.getEmailAnalytics({
      userId: user.role === 'admin' ? validatedParams.userId : user.id,
      category: validatedParams.category || undefined,
      status: validatedParams.status ? [validatedParams.status] : undefined,
      startDate: validatedParams.startDate ? new Date(validatedParams.startDate) : undefined,
      endDate: validatedParams.endDate ? new Date(validatedParams.endDate) : undefined
    })

    if (!analytics.success) {
      return NextResponse.json(
        { success: false, error: analytics.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: analytics.data,
      message: 'Email analytics retrieved successfully'
    })

  } catch (error: any) {
    console.error('Email analytics error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch email analytics'
    }, { status: 500 })
  }
}
```

Create `app/api/email/quota/route.ts`:
```typescript
import { type NextRequest, NextResponse } from "next/server"
import { EmailService } from '@/lib/services/email-service'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// GET /api/email/quota - Get SES send quota
export async function GET(request: NextRequest) {
  try {
    const { session, user } = await genericApiRoutesMiddleware(request, 'email', 'read')

    const quota = await EmailService.getSendQuota()

    if (!quota.success) {
      return NextResponse.json(
        { success: false, error: quota.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: quota.data,
      message: 'Send quota retrieved successfully'
    })

  } catch (error: any) {
    console.error('Quota fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch quota'
    }, { status: 500 })
  }
}
```

### Step 5.2: File API Routes

Create `app/api/files/route.ts`:
```typescript
import { type NextRequest, NextResponse } from "next/server"
import { FileService } from '@/lib/services/file-service'
import { fileQuerySchema } from '@/lib/validations/file'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// GET /api/files - List user files
export async function GET(request: NextRequest) {
  try {
    const { session, user } = await genericApiRoutesMiddleware(request, 'files', 'read')
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || '',
      category: searchParams.get('category') || '',
      status: searchParams.get('status') || '',
      departmentId: searchParams.get('departmentId') || '',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    }

    const validatedParams = fileQuerySchema.parse(queryParams)

    const result = await FileService.listFiles({
      ...validatedParams,
      userId: user.id
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Files retrieved successfully'
    })

  } catch (error: any) {
    console.error('File list error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch files'
    }, { status: 500 })
  }
}
```

Create `app/api/files/upload-url/route.ts`:
```typescript
import { type NextRequest, NextResponse } from "next/server"
import { FileService } from '@/lib/services/file-service'
import { generateUploadUrlSchema } from '@/lib/validations/file'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// POST /api/files/upload-url - Generate presigned upload URL
export async function POST(request: NextRequest) {
  try {
    const { session, user } = await genericApiRoutesMiddleware(request, 'files', 'create')

    const body = await request.json()
    const validatedData = generateUploadUrlSchema.parse(body)

    const result = await FileService.generateUploadUrl({
      ...validatedData,
      userId: user.id
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: result.uploadUrl,
        fileKey: result.fileKey,
        fileId: result.fileId,
        expiresIn: result.expiresIn
      },
      message: 'Upload URL generated successfully'
    })

  } catch (error: any) {
    console.error('Upload URL generation error:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate upload URL'
    }, { status: 500 })
  }
}
```

Create `app/api/files/upload-complete/route.ts`:
```typescript
import { type NextRequest, NextResponse } from "next/server"
import { FileService } from '@/lib/services/file-service'
import { uploadCompleteSchema } from '@/lib/validations/file'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// POST /api/files/upload-complete - Mark upload as completed
export async function POST(request: NextRequest) {
  try {
    const { session, user } = await genericApiRoutesMiddleware(request, 'files', 'create')

    const body = await request.json()
    const validatedData = uploadCompleteSchema.parse(body)

    const result = await FileService.completeUpload(validatedData)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Upload completed successfully'
    })

  } catch (error: any) {
    console.error('Upload completion error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to complete upload'
    }, { status: 500 })
  }
}
```

Create `app/api/files/[id]/route.ts`:
```typescript
import { type NextRequest, NextResponse } from "next/server"
import { FileService } from '@/lib/services/file-service'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

interface RouteParams {
  params: { id: string }
}

// GET /api/files/[id] - Get download URL
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user } = await genericApiRoutesMiddleware(request, 'files', 'read')

    const result = await FileService.getDownloadUrl(params.id, user.id)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error.includes('not found') ? 404 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: result.downloadUrl,
        file: result.file
      },
      message: 'Download URL generated successfully'
    })

  } catch (error: any) {
    console.error('Download URL generation error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate download URL'
    }, { status: 500 })
  }
}

// DELETE /api/files/[id] - Delete file
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user } = await genericApiRoutesMiddleware(request, 'files', 'delete')

    const result = await FileService.deleteFile(params.id, user.id)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error.includes('not found') ? 404 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message
    })

  } catch (error: any) {
    console.error('Delete file error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to delete file'
    }, { status: 500 })
  }
}
```

---

## 📊 **PHASE 6: State Management**

### Step 6.1: Email Redux Slice

Create `store/slices/emailSlice.ts`:
```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { SendEmailData, EmailQueryParams } from '@/lib/validations/email'

// Types
interface EmailLog {
  _id: string
  messageId: string
  to: string[]
  from: string
  subject: string
  category: string
  status: string
  priority: string
  cost: number
  size: number
  createdAt: string
  updatedAt: string
}

interface EmailStats {
  totalEmails: number
  totalCost: number
  avgSize: number
  byStatus: Array<{ status: string; count: number }>
  byCategory: Array<{ category: string; count: number }>
}

interface EmailState {
  emails: EmailLog[]
  stats: EmailStats | null
  quota: {
    maxSend24Hour?: number
    maxSendRate?: number
    sentLast24Hours?: number
  } | null
  loading: boolean
  sendLoading: boolean
  error: string | null
  filters: Partial<EmailQueryParams>
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// Async Thunks
export const sendEmail = createAsyncThunk(
  'email/sendEmail',
  async (emailData: SendEmailData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      })

      const data = await response.json()
      if (!data.success) {
        return rejectWithValue(data.error)
      }

      return data
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchEmailAnalytics = createAsyncThunk(
  'email/fetchAnalytics',
  async (params: Partial<EmailQueryParams> = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`/api/email?${queryParams.toString()}`)
      const data = await response.json()

      if (!data.success) {
        return rejectWithValue(data.error)
      }

      return data.data
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchEmailQuota = createAsyncThunk(
  'email/fetchQuota',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/email/quota')
      const data = await response.json()

      if (!data.success) {
        return rejectWithValue(data.error)
      }

      return data.data
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

// Initial State
const initialState: EmailState = {
  emails: [],
  stats: null,
  quota: null,
  loading: false,
  sendLoading: false,
  error: null,
  filters: {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  },
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  }
}

// Slice
const emailSlice = createSlice({
  name: 'email',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<EmailQueryParams>>) => {
      state.filters = { ...state.filters, ...action.payload }
      if (action.payload.page === undefined) {
        state.filters.page = 1 // Reset to first page when filtering
      }
    },
    clearError: (state) => {
      state.error = null
    },
    resetState: () => initialState
  },
  extraReducers: (builder) => {
    // Send Email
    builder
      .addCase(sendEmail.pending, (state) => {
        state.sendLoading = true
        state.error = null
      })
      .addCase(sendEmail.fulfilled, (state, action) => {
        state.sendLoading = false
        // Optionally refresh analytics after sending
      })
      .addCase(sendEmail.rejected, (state, action) => {
        state.sendLoading = false
        state.error = action.payload as string
      })

    // Fetch Analytics
    builder
      .addCase(fetchEmailAnalytics.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchEmailAnalytics.fulfilled, (state, action) => {
        state.loading = false
        state.stats = action.payload.stats
        state.emails = action.payload.recentEmails || []
      })
      .addCase(fetchEmailAnalytics.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

    // Fetch Quota
    builder
      .addCase(fetchEmailQuota.fulfilled, (state, action) => {
        state.quota = action.payload
      })
  }
})

export const { setFilters, clearError, resetState } = emailSlice.actions
export default emailSlice.reducer
```

### Step 6.2: File Redux Slice

Create `store/slices/fileSlice.ts`:
```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { GenerateUploadUrlData, FileQueryParams } from '@/lib/validations/file'

// Types
interface FileItem {
  _id: string
  key: string
  fileName: string
  originalName: string
  contentType: string
  size: number
  category: string
  status: string
  isPublic: boolean
  userId: string
  departmentId?: string
  createdAt: string
  updatedAt: string
}

interface FileState {
  files: FileItem[]
  loading: boolean
  uploadLoading: boolean
  error: string | null
  filters: Partial<FileQueryParams>
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  uploadProgress: Record<string, number> // fileId -> progress %
}

// Async Thunks
export const fetchFiles = createAsyncThunk(
  'files/fetchFiles',
  async (params: Partial<FileQueryParams> = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`/api/files?${queryParams.toString()}`)
      const data = await response.json()

      if (!data.success) {
        return rejectWithValue(data.error)
      }

      return data.data
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const uploadFile = createAsyncThunk(
  'files/uploadFile',
  async (
    { file, uploadData }: { file: File; uploadData: GenerateUploadUrlData },
    { rejectWithValue, dispatch }
  ) => {
    try {
      // Step 1: Get upload URL
      const urlResponse = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadData)
      })

      const urlData = await urlResponse.json()
      if (!urlData.success) {
        return rejectWithValue(urlData.error)
      }

      // Step 2: Upload to S3
      const uploadResponse = await fetch(urlData.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': uploadData.contentType
        }
      })

      if (!uploadResponse.ok) {
        return rejectWithValue('Upload to S3 failed')
      }

      // Step 3: Complete upload
      const completeResponse = await fetch('/api/files/upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: urlData.data.fileId,
          actualSize: file.size
        })
      })

      const completeData = await completeResponse.json()
      if (!completeData.success) {
        return rejectWithValue(completeData.error)
      }

      return completeData.data.file
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const deleteFile = createAsyncThunk(
  'files/deleteFile',
  async (fileId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (!data.success) {
        return rejectWithValue(data.error)
      }

      return fileId
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

// Initial State
const initialState: FileState = {
  files: [],
  loading: false,
  uploadLoading: false,
  error: null,
  filters: {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  },
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  },
  uploadProgress: {}
}

// Slice
const fileSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<FileQueryParams>>) => {
      state.filters = { ...state.filters, ...action.payload }
      if (action.payload.page === undefined) {
        state.filters.page = 1
      }
    },
    setUploadProgress: (state, action: PayloadAction<{ fileId: string; progress: number }>) => {
      state.uploadProgress[action.payload.fileId] = action.payload.progress
    },
    clearUploadProgress: (state, action: PayloadAction<string>) => {
      delete state.uploadProgress[action.payload]
    },
    clearError: (state) => {
      state.error = null
    },
    resetState: () => initialState
  },
  extraReducers: (builder) => {
    // Fetch Files
    builder
      .addCase(fetchFiles.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchFiles.fulfilled, (state, action) => {
        state.loading = false
        state.files = action.payload.files
        state.pagination = action.payload.pagination
      })
      .addCase(fetchFiles.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

    // Upload File
    builder
      .addCase(uploadFile.pending, (state) => {
        state.uploadLoading = true
        state.error = null
      })
      .addCase(uploadFile.fulfilled, (state, action) => {
        state.uploadLoading = false
        state.files.unshift(action.payload)
      })
      .addCase(uploadFile.rejected, (state, action) => {
        state.uploadLoading = false
        state.error = action.payload as string
      })

    // Delete File
    builder
      .addCase(deleteFile.fulfilled, (state, action) => {
        state.files = state.files.filter(file => file._id !== action.payload)
      })
  }
})

export const {
  setFilters,
  setUploadProgress,
  clearUploadProgress,
  clearError,
  resetState
} = fileSlice.actions

export default fileSlice.reducer
```

### Step 6.3: Update Store Configuration

Update `store/index.ts` to include the new slices:
```typescript
import { configureStore } from '@reduxjs/toolkit'
import departmentReducer from './slices/departmentSlice'
// ... other existing reducers
import emailReducer from './slices/emailSlice'
import fileReducer from './slices/fileSlice'

export const store = configureStore({
  reducer: {
    departments: departmentReducer,
    // ... other existing reducers
    email: emailReducer,
    files: fileReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

### Step 6.4: Custom Hooks

Create `hooks/use-email.ts`:
```typescript
import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  sendEmail,
  fetchEmailAnalytics,
  fetchEmailQuota,
  setFilters,
  clearError,
  resetState
} from '@/store/slices/emailSlice'
import { SendEmailData, EmailQueryParams } from '@/lib/validations/email'
import { useToast } from './use-toast'

export function useEmail() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()

  const {
    emails,
    stats,
    quota,
    loading,
    sendLoading,
    error,
    filters,
    pagination
  } = useAppSelector((state) => state.email)

  // Send email
  const handleSendEmail = useCallback(async (emailData: SendEmailData) => {
    try {
      const result = await dispatch(sendEmail(emailData)).unwrap()
      
      toast({
        title: "Email Sent",
        description: "Your email has been sent successfully.",
        variant: "default"
      })

      // Refresh analytics after sending
      dispatch(fetchEmailAnalytics(filters))

      return result
    } catch (error: any) {
      toast({
        title: "Email Error",
        description: error || "Failed to send email",
        variant: "destructive"
      })
      throw error
    }
  }, [dispatch, toast, filters])

  // Fetch analytics
  const handleFetchAnalytics = useCallback((params?: Partial<EmailQueryParams>) => {
    return dispatch(fetchEmailAnalytics(params || filters))
  }, [dispatch, filters])

  // Fetch quota
  const handleFetchQuota = useCallback(() => {
    return dispatch(fetchEmailQuota())
  }, [dispatch])

  // Set filters
  const handleSetFilters = useCallback((newFilters: Partial<EmailQueryParams>) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  // Utility functions
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const refreshAnalytics = useCallback(() => {
    return handleFetchAnalytics()
  }, [handleFetchAnalytics])

  // Pre-built email functions
  const send2FAEmail = useCallback(async (email: string, name: string, token: string) => {
    return handleSendEmail({
      to: email,
      subject: 'Security Code - DepLLC CRM',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Security Code</h2>
          <p>Hello ${name},</p>
          <p>Your security code is: <strong style="font-size: 24px; color: #2563eb;">${token}</strong></p>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please contact support.</p>
        </div>
      `,
      textContent: `Hello ${name},\n\nYour security code is: ${token}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please contact support.`,
      category: 'auth',
      priority: 'high'
    })
  }, [handleSendEmail])

  const sendWelcomeEmail = useCallback(async (email: string, name: string, isClient = false) => {
    return handleSendEmail({
      to: email,
      subject: `Welcome to DepLLC CRM${isClient ? ' Client Portal' : ''}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to DepLLC CRM</h2>
          <p>Hello ${name},</p>
          <p>Welcome to the DepLLC CRM ${isClient ? 'Client Portal' : 'system'}! Your account has been created successfully.</p>
          <p>You can now access all the features available to you.</p>
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          <p>Best regards,<br>The DepLLC Team</p>
        </div>
      `,
      textContent: `Hello ${name},\n\nWelcome to DepLLC CRM! Your account has been created successfully.\n\nBest regards,\nThe DepLLC Team`,
      category: isClient ? 'client-portal' : 'auth',
      priority: 'normal'
    })
  }, [handleSendEmail])

  const sendPasswordResetEmail = useCallback(async (email: string, name: string, resetToken: string) => {
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`
    
    return handleSendEmail({
      to: email,
      subject: 'Password Reset - DepLLC CRM',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hello ${name},</p>
          <p>You requested a password reset for your DepLLC CRM account.</p>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
        </div>
      `,
      textContent: `Hello ${name},\n\nYou requested a password reset for your DepLLC CRM account.\n\nClick this link to reset your password: ${resetUrl}\n\nThis link will expire in 24 hours.`,
      category: 'auth',
      priority: 'high'
    })
  }, [handleSendEmail])

  return {
    // State
    emails,
    stats,
    quota,
    loading,
    sendLoading,
    error,
    filters,
    pagination,

    // Actions
    sendEmail: handleSendEmail,
    fetchAnalytics: handleFetchAnalytics,
    fetchQuota: handleFetchQuota,
    setFilters: handleSetFilters,
    clearError: handleClearError,
    refreshAnalytics,

    // Pre-built emails
    send2FAEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail
  }
}
```

Create `hooks/use-file-upload.ts`:
```typescript
import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  fetchFiles,
  uploadFile,
  deleteFile,
  setFilters,
  setUploadProgress,
  clearUploadProgress,
  clearError,
  resetState
} from '@/store/slices/fileSlice'
import { GenerateUploadUrlData, FileQueryParams } from '@/lib/validations/file'
import { useToast } from './use-toast'

export function useFileUpload() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()

  const {
    files,
    loading,
    uploadLoading,
    error,
    filters,
    pagination,
    uploadProgress
  } = useAppSelector((state) => state.files)

  // Fetch files
  const handleFetchFiles = useCallback((params?: Partial<FileQueryParams>) => {
    return dispatch(fetchFiles(params || filters))
  }, [dispatch, filters])

  // Upload file
  const handleUploadFile = useCallback(async (
    file: File,
    uploadData: GenerateUploadUrlData
  ) => {
    try {
      const result = await dispatch(uploadFile({ file, uploadData })).unwrap()
      
      toast({
        title: "Upload Successful",
        description: `${file.name} has been uploaded successfully.`,
        variant: "default"
      })

      return result
    } catch (error: any) {
      toast({
        title: "Upload Error",
        description: error || "Upload failed",
        variant: "destructive"
      })
      throw error
    }
  }, [dispatch, toast])

  // Delete file
  const handleDeleteFile = useCallback(async (fileId: string) => {
    try {
      await dispatch(deleteFile(fileId)).unwrap()
      
      toast({
        title: "File Deleted",
        description: "File has been deleted successfully.",
        variant: "default"
      })
    } catch (error: any) {
      toast({
        title: "Delete Error",
        description: error || "Failed to delete file",
        variant: "destructive"
      })
      throw error
    }
  }, [dispatch, toast])

  // Download file
  const handleDownloadFile = useCallback(async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error)
      }

      // Open download URL in new tab
      window.open(data.data.downloadUrl, '_blank')
      
      return data.data
    } catch (error: any) {
      toast({
        title: "Download Error",
        description: error.message || "Failed to download file",
        variant: "destructive"
      })
      throw error
    }
  }, [toast])

  // Set filters
  const handleSetFilters = useCallback((newFilters: Partial<FileQueryParams>) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  // Utility functions
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const refreshFiles = useCallback(() => {
    return handleFetchFiles()
  }, [handleFetchFiles])

  // File validation helper
  const validateFile = useCallback((file: File) => {
    const maxSize = 100 * 1024 * 1024 // 100MB
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ]

    if (file.size > maxSize) {
      throw new Error('File size exceeds 100MB limit')
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error('File type not supported')
    }

    return true
  }, [])

  return {
    // State
    files,
    loading,
    uploadLoading,
    error,
    filters,
    pagination,
    uploadProgress,

    // Actions
    fetchFiles: handleFetchFiles,
    uploadFile: handleUploadFile,
    deleteFile: handleDeleteFile,
    downloadFile: handleDownloadFile,
    setFilters: handleSetFilters,
    clearError: handleClearError,
    refreshFiles,

    // Utilities
    validateFile,
    setUploadProgress: (fileId: string, progress: number) =>
      dispatch(setUploadProgress({ fileId, progress })),
    clearUploadProgress: (fileId: string) => dispatch(clearUploadProgress(fileId))
  }
}
```

---

Continue with the final phases in the next part...