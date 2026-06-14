import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AuthUser = {
  id: string;
  username: string;
  name?: string;
  fullName?: string;
  mobileNumber?: string;
  role?: string;
  companyId?: string;
  permissions?: string[];
  mobilePermissions?: Record<string, unknown>;
};

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  superAdminMode: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  superAdminMode: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: AuthUser; token: string }>
    ) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.superAdminMode = false;
    },
    setSuperAdminMode: (state, action: PayloadAction<boolean>) => {
      state.superAdminMode = action.payload;
    },
    clearSuperAdminMode: (state) => {
      state.superAdminMode = false;
    },
  },
});

export const { setCredentials, logout, setSuperAdminMode, clearSuperAdminMode } = authSlice.actions;
export default authSlice.reducer;
