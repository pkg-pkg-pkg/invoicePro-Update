import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-client-source': 'mobile',
    'x-client-platform': 'mobile',
  },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = (global as any).__MOBILE_AUTH_TOKEN__ as string | undefined;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function setMobileAuthToken(token: string | null) {
  if (token) {
    (global as any).__MOBILE_AUTH_TOKEN__ = token;
  } else {
    delete (global as any).__MOBILE_AUTH_TOKEN__;
  }
}

export default api;

