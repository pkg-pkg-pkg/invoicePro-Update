// src/store/slices/authSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AuthState {
  user: any | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  role?: string;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  role: undefined,
};

// Example thunks: login / logout / fetchProfile
export const login = createAsyncThunk<any, { username: string; password: string }, { rejectValue: string }>(
  'auth/login',
  async (creds, thunkAPI) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      if (!res.ok) return thunkAPI.rejectWithValue('Invalid credentials');
      return (await res.json()) as any;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const logout = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/logout',
  async () => {
    // optionally call backend to logout
    return;
  }
);

export const fetchProfile = createAsyncThunk<any, void, { rejectValue: string }>(
  'auth/fetchProfile',
  async (_, thunkAPI) => {
    try {
      const res = await fetch('/api/auth/profile');
      if (!res.ok) return thunkAPI.rejectWithValue('Failed to fetch profile');
      return (await res.json()) as any;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setUser(state, action: PayloadAction<any | null>) {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.user = action.payload.user ?? action.payload;
        state.token = action.payload.token ?? state.token;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Login failed';
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      })
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to fetch profile';
      });
  },
});

export const { clearError, setToken, setUser } = authSlice.actions;

export const selectAuthUser = (state: any) => state.auth?.user ?? null;
export const selectAuthToken = (state: any) => state.auth?.token ?? null;
export const selectAuthLoading = (state: any) => !!state.auth?.loading;
export const selectAuthError = (state: any) => state.auth?.error ?? null;
export const selectIsAuthenticated = (state: any) => !!state.auth?.isAuthenticated;

export default authSlice.reducer;
