import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

interface AuthState {
  isAuthenticated: boolean
  user: {
    id: string
    name: string
    email: string
    role: string
    avatar?: string
  } | null
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<AuthState["user"]>) => {
      state.isAuthenticated = true
      state.user = action.payload
    },
    clearAuth: (state) => {
      state.isAuthenticated = false
      state.user = null
      
      // Clear localStorage when clearing auth state
      if (typeof window !== 'undefined') {
        localStorage.removeItem('logged_in_user')
        localStorage.removeItem('user_permissions')
        localStorage.removeItem('user_role')
        localStorage.removeItem('user_department')
        
        // Clear any other cached user data
        const keysToRemove = Object.keys(localStorage).filter(key => 
          key.startsWith('user_') || 
          key.startsWith('auth_') || 
          key.startsWith('session_')
        )
        keysToRemove.forEach(key => localStorage.removeItem(key))
        
        // Clear sessionStorage as well
        sessionStorage.clear()
      }
    },
  },
})

export const { setAuth, clearAuth } = authSlice.actions
export default authSlice.reducer
