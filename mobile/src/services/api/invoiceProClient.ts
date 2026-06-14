import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { store } from '../../store';

import { logout } from '../../store/slices/authSlice';

import { clearAuthSession } from '../authStorage';

import { getMiddlewareApiBase, getMiddlewareOrigin } from '../middlewareUrl';



const JWT_KEY = 'jwt_token';

const REFRESH_KEY = 'refresh_token';



let isRefreshing = false;

let refreshWaiters: Array<(token: string) => void> = [];



function notifyRefreshed(token: string): void {

  refreshWaiters.forEach((cb) => cb(token));

  refreshWaiters = [];

}



async function getStoredJwt(): Promise<string | null> {

  return AsyncStorage.getItem(JWT_KEY);

}



async function getStoredRefresh(): Promise<string | null> {

  return AsyncStorage.getItem(REFRESH_KEY);

}



export async function storeTokens(jwt: string, refresh: string): Promise<void> {

  await AsyncStorage.multiSet([

    [JWT_KEY, jwt],

    [REFRESH_KEY, refresh],

  ]);

}



async function handleAuthFailure(): Promise<void> {

  await clearAuthSession();

  store.dispatch(logout());

}



export const invoiceProClient = axios.create({

  baseURL: getMiddlewareOrigin(),

  headers: {

    'Content-Type': 'application/json',

    'x-client-source': 'mobile',

    'x-client-platform': 'mobile',

  },

  timeout: 30000,

});



invoiceProClient.interceptors.request.use(async (config) => {

  config.baseURL = getMiddlewareOrigin();

  const token = await getStoredJwt();

  if (token) {

    config.headers.Authorization = `Bearer ${token}`;

  }

  return config;

});



invoiceProClient.interceptors.response.use(

  (response) => response,

  async (error: AxiosError) => {

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {

      return Promise.reject(error);

    }



    const requestUrl = String(originalRequest.url || '');

    if (requestUrl.includes('/api/auth/refresh') || requestUrl.includes('/api/auth/login')) {

      await handleAuthFailure();

      return Promise.reject(error);

    }



    const refreshToken = await getStoredRefresh();

    if (!refreshToken) {

      await handleAuthFailure();

      return Promise.reject(error);

    }



    if (isRefreshing) {

      return new Promise((resolve, reject) => {

        refreshWaiters.push((token: string) => {

          originalRequest.headers.Authorization = `Bearer ${token}`;

          resolve(invoiceProClient(originalRequest));

        });

        setTimeout(() => reject(error), 15000);

      });

    }



    originalRequest._retry = true;

    isRefreshing = true;



    try {

      const res = await axios.post<RefreshResponse>(`${getMiddlewareApiBase()}/auth/refresh`, {

        refreshToken,

      });

      const newJwt = res.data.token || res.data.jwt;

      const newRefresh = res.data.refreshToken || refreshToken;

      if (!newJwt) {

        throw new Error('Token refresh returned no access token');

      }

      await storeTokens(newJwt, newRefresh);

      notifyRefreshed(newJwt);

      originalRequest.headers.Authorization = `Bearer ${newJwt}`;

      return invoiceProClient(originalRequest);

    } catch {

      await handleAuthFailure();

      return Promise.reject(error);

    } finally {

      isRefreshing = false;

    }

  }

);



export type InvoiceProUser = {

  id: string;

  name?: string;

  username?: string;

  fullName?: string;

  email?: string;

  mobileNumber?: string;

  role: string;

  companyId?: string;

  permissions?: string[];

  mobilePermissions?: Record<string, unknown>;

};



export type LoginRequest = {

  mobile_no: string;

};



export type LoginResponse = {

  success: boolean;

  token: string;

  refreshToken?: string;

  jwt?: string;

  user: InvoiceProUser;

  error?: string;

};



export type RefreshResponse = {

  success?: boolean;

  token: string;

  jwt?: string;

  refreshToken?: string;

  error?: string;

};



export type SyncPushPayload = {

  entityType: string;

  entityId: string;

  operation: 'CREATE' | 'UPDATE' | 'DELETE';

  payload: Record<string, unknown>;

  version?: number;

  timestamp: string;

  source?: string;

};



export type SyncRecord = {

  entityType: string;

  entityId: string;

  operation: string;

  payload: Record<string, unknown>;

  timestamp?: string;

  version?: number;

};



export type SyncFetchResponse = {

  success?: boolean;

  records?: SyncRecord[];

  changes?: SyncRecord[];

  lastFetchedAt?: string;

};



export type ChildUser = {

  id: string;

  name?: string;

  username?: string;

  email?: string;

  role?: string;

  permissions?: string[];

  isActive?: boolean;

};



export type PendingUser = {

  id: string;

  name?: string;

  username?: string;

  email?: string;

  requestedAt?: string;

};



type IpaLoginResponse = {

  token: string;

  user: {

    user_id: string;

    name?: string;

    is_child?: boolean;

    parent_user_id?: string;

  };

};



export async function apiLogin(credentials: LoginRequest): Promise<LoginResponse> {

  const mobile_no = credentials.mobile_no.replace(/\D/g, '');

  const res = await invoiceProClient.post<IpaLoginResponse>('/api/auth/login', { mobile_no });

  const { token, user } = res.data;

  return {

    success: true,

    token,

    jwt: token,

    refreshToken: token,

    user: {

      id: user.user_id,

      name: user.name,

      fullName: user.name,

      mobileNumber: mobile_no,

      role: user.is_child ? 'child' : 'parent',

    },

  };

}



export async function apiRefresh(refreshToken: string): Promise<RefreshResponse> {

  const res = await invoiceProClient.post<RefreshResponse>('/api/auth/refresh', { refreshToken });

  return res.data;

}



export async function apiSyncFetch(since?: string): Promise<SyncFetchResponse> {

  const res = await invoiceProClient.get<SyncFetchResponse>('/api/sync/fetch', {

    params: since ? { since } : undefined,

  });

  return res.data;

}



export async function apiSyncPush(payload: SyncPushPayload): Promise<void> {

  await invoiceProClient.post('/api/sync/push', payload);

}



export async function apiGetChildUsers(): Promise<ChildUser[]> {

  const res = await invoiceProClient.get<{ data?: ChildUser[]; users?: ChildUser[] }>(

    '/api/users/children'

  );

  return res.data.data ?? res.data.users ?? [];

}



export async function apiGetPendingUsers(): Promise<PendingUser[]> {

  const res = await invoiceProClient.get<{ data?: PendingUser[]; users?: PendingUser[] }>(

    '/api/users/pending'

  );

  return res.data.data ?? res.data.users ?? [];

}

export * from './dataApi';

