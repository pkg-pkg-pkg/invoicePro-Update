import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';
let runtimeBaseUrl = API_BASE_URL;

const api = axios.create({
  baseURL: runtimeBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    'x-client-source': 'mobile',
    'x-client-platform': 'mobile',
  },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  config.baseURL = runtimeBaseUrl;
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

export function setMobileApiBaseUrl(baseUrl: string | null) {
  runtimeBaseUrl = (baseUrl || API_BASE_URL).trim();
}

export function getMobileApiBaseUrl() {
  return runtimeBaseUrl;
}

export default api;

