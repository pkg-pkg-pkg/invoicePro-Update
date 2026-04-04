import api from './api';

// Types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  gstin?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  refreshToken?: string;
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: string;
    company?: {
      id: string;
      name: string;
      gstin?: string;
    };
  };
  message?: string;
  error?: string;
}

export interface MeResponse {
  success: boolean;
  data: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: string;
    company?: {
      id: string;
      name: string;
      gstin?: string;
    };
  };
}

// Auth service functions
export const authService = {
  // Login user
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/login', credentials);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },

  // Register new user/company
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/register', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  // Get current user info
  async getMe(): Promise<MeResponse> {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get user info');
    }
  },

  // Refresh token
  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      const response = await api.post('/auth/refresh', { refreshToken });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Token refresh failed');
    }
  },

  // Logout user
  async logout(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post('/auth/logout');
      return response.data;
    } catch (error: any) {
      // Logout should succeed even if server request fails
      return { success: true, message: 'Logged out locally' };
    }
  },
};

// Utility functions
export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch {
    return true; // Assume expired if can't parse
  }
};

export const getTokenExpiry = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000; // Convert to milliseconds
  } catch {
    return null;
  }
};

