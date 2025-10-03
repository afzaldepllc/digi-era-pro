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
    },
  },
})

export const { setAuth, clearAuth } = authSlice.actions
export default authSlice.reducer
