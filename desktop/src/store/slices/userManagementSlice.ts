// src/store/slices/userManagementSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, UserRole, UserPermissions, DEFAULT_PERMISSIONS } from './authSlice';

// Serializable version of User for Redux state
export interface SerializableUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  password?: string;
  role: UserRole;
  permissions: UserPermissions;
  isActive: boolean;
  lastLogin?: string; // ISO string instead of Date
  createdAt: string; // ISO string instead of Date
  updatedAt: string; // ISO string instead of Date
}

export interface UserManagementState {
  users: SerializableUser[];
  loading: boolean;
  error: string | null;
  selectedUser: SerializableUser | null;
}

const initialState: UserManagementState = {
  users: [],
  loading: false,
  error: null,
  selectedUser: null,
};

// Helper function to deep clone permissions
const clonePermissions = (permissions: UserPermissions): UserPermissions => {
  return JSON.parse(JSON.stringify(permissions));
};

// Storage key for users
const USERS_STORAGE_KEY = 'gst_billing_users';

// Helper functions for localStorage operations
const getStoredUsers = (): SerializableUser[] => {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Keep dates as ISO strings for Redux state
      return parsed.map((user: any) => ({
        ...user,
        lastLogin: user.lastLogin || undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));
    }
  } catch (error) {
    console.warn('Failed to load users from localStorage:', error);
  }
  return [];
};

const saveUsers = (users: SerializableUser[]): void => {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (error) {
    console.warn('Failed to save users to localStorage:', error);
  }
};

// Async thunks for user management (using localStorage)
export const fetchUsers = createAsyncThunk<SerializableUser[], void, { rejectValue: string }>(
  'userManagement/fetchUsers',
  async (_, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return getStoredUsers();
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to fetch users');
    }
  }
);

export const createUser = createAsyncThunk<SerializableUser, {
  username: string;
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
}, { rejectValue: string }>(
  'userManagement/createUser',
  async (userData, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));

      const users = [...getStoredUsers()];

      // Check if username already exists
      if (users.some(user => user.username === userData.username)) {
        return thunkAPI.rejectWithValue('Username already exists');
      }

      // Check if email already exists
      if (users.some(user => user.email === userData.email)) {
        return thunkAPI.rejectWithValue('Email already exists');
      }

      const newUser: SerializableUser = {
        id: Date.now().toString(),
        ...userData,
        permissions: clonePermissions(DEFAULT_PERMISSIONS[userData.role]),
        isActive: true,
        lastLogin: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      users.push(newUser);
      saveUsers(users);

      return newUser;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to create user');
    }
  }
);

export const updateUser = createAsyncThunk<SerializableUser, {
  id: string;
  updates: Partial<SerializableUser>;
}, { rejectValue: string }>(
  'userManagement/updateUser',
  async ({ id, updates }, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 600));

      const users = [...getStoredUsers()]; // Ensure we have a mutable copy
      const userIndex = users.findIndex(user => user.id === id);

      if (userIndex === -1) {
        return thunkAPI.rejectWithValue('User not found');
      }

      // Check if username/email conflicts (only if they're being updated)
      if (updates.username && users.some(user => user.id !== id && user.username === updates.username)) {
        return thunkAPI.rejectWithValue('Username already exists');
      }

      if (updates.email && users.some(user => user.id !== id && user.email === updates.email)) {
        return thunkAPI.rejectWithValue('Email already exists');
      }

      const updatedUser = {
        ...users[userIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      users[userIndex] = updatedUser;
      saveUsers(users);

      return updatedUser;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to update user');
    }
  }
);

export const deleteUser = createAsyncThunk<string, string, { rejectValue: string }>(
  'userManagement/deleteUser',
  async (userId, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const users = [...getStoredUsers()]; // Ensure we have a mutable copy
      const userIndex = users.findIndex(user => user.id === userId);

      if (userIndex === -1) {
        return thunkAPI.rejectWithValue('User not found');
      }

      // Prevent deleting the last admin user
      const adminUsers = users.filter(user => user.role === 'admin');
      if (adminUsers.length === 1 && adminUsers[0].id === userId) {
        return thunkAPI.rejectWithValue('Cannot delete the last admin user');
      }

      users.splice(userIndex, 1);
      saveUsers(users);

      return userId;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to delete user');
    }
  }
);

export const updateUserPermissions = createAsyncThunk<SerializableUser, {
  userId: string;
  permissions: Partial<User['permissions']>;
}, { rejectValue: string }>(
  'userManagement/updateUserPermissions',
  async ({ userId, permissions }, thunkAPI) => {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 600));

      const users = [...getStoredUsers()]; // Ensure we have a mutable copy
      const userIndex = users.findIndex(user => user.id === userId);

      if (userIndex === -1) {
        return thunkAPI.rejectWithValue('User not found');
      }

      const updatedUser = {
        ...users[userIndex],
        permissions: {
          ...users[userIndex].permissions,
          ...permissions,
        },
        updatedAt: new Date().toISOString(),
      };

      users[userIndex] = updatedUser;
      saveUsers(users);

      return updatedUser;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to update permissions');
    }
  }
);

const userManagementSlice = createSlice({
  name: 'userManagement',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setSelectedUser(state, action: PayloadAction<SerializableUser | null>) {
      state.selectedUser = action.payload;
    },
    resetUserForm(state) {
      state.selectedUser = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch users
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to fetch users';
      })

      // Create user
      .addCase(createUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users = [...state.users, action.payload];
      })
      .addCase(createUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to create user';
      })

      // Update user
      .addCase(updateUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.users.findIndex(user => user.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.selectedUser?.id === action.payload.id) {
          state.selectedUser = action.payload;
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to update user';
      })

      // Delete user
      .addCase(deleteUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users = state.users.filter(user => user.id !== action.payload);
        if (state.selectedUser?.id === action.payload) {
          state.selectedUser = null;
        }
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to delete user';
      })

      // Update permissions
      .addCase(updateUserPermissions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserPermissions.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.users.findIndex(user => user.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.selectedUser?.id === action.payload.id) {
          state.selectedUser = action.payload;
        }
      })
      .addCase(updateUserPermissions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to update permissions';
      });
  },
});

export const { clearError, setSelectedUser, resetUserForm } = userManagementSlice.actions;

export default userManagementSlice.reducer;
