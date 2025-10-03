import { configureStore } from "@reduxjs/toolkit"
import { persistStore, persistReducer } from "redux-persist"
import storage from "redux-persist/lib/storage"
import { combineReducers } from "@reduxjs/toolkit"
import authSlice from "./slices/authSlice"
import userSlice from "./slices/userSlice"
import departmentSlice from "./slices/departmentSlice"
import roleSlice from "./slices/roleSlice"
import systemPermissionSlice from "./slices/systemPermissionSlice"

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["auth"], // Only persist auth slice
}

const rootReducer = combineReducers({
  auth: authSlice,
  users: userSlice,
  departments: departmentSlice,
  roles: roleSlice,
  systemPermissions: systemPermissionSlice,
})

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
