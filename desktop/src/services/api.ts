import axios, { AxiosInstance, AxiosError } from 'axios';
import { resolveApiBaseUrl } from '../utils/apiConfig';

const API_BASE_URL = resolveApiBaseUrl();

const isOfflineRuntime = () => {
  try {
    if ((window as any).electronAPI != null) return true;
    if ((window as any).__TAURI__ != null) return true;
    if ((window as any).__TAURI_INTERNALS__ != null) return true;
    if ((window as any).__TAURI_IPC__ != null) return true;
    if ((window as any).__TAURI_METADATA__ != null) return true;
    if ((navigator as any)?.userAgent && String((navigator as any).userAgent).toLowerCase().includes('tauri')) return true;
    if (window.location.hostname === 'tauri.localhost') return true;
    const p = window.location.protocol;
    return p === 'tauri:' || p === 'file:';
  } catch {
    return false;
  }
};

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 4000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (isOfflineRuntime()) {
      return Promise.reject(new AxiosError('Offline mode', 'ERR_OFFLINE', config));
    }
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if ((error as any)?.code === 'ERR_OFFLINE') {
      return Promise.reject(error);
    }
    const requestUrl = String(error.config?.url ?? '');
    const isFeedbackRequest = requestUrl.includes('/feedback/send');
    if (isFeedbackRequest) {
      // Feedback should gracefully fallback to local outbox without forcing logout.
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!isOfflineRuntime()) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

