// src/store.ts - FIXED AND STABLE VERSION
import { configureStore } from '@reduxjs/toolkit';
import type { Middleware } from 'redux';

// Slices
import authReducer from './store/slices/authSlice';
import bankReducer from './store/slices/bankSlice';
import customerReducer from './store/slices/customerSlice';
import dashboardReducer from './store/slices/dashboardSlice';
import invoiceReducer from './store/slices/invoiceSlice';
import partyReducer from './store/slices/partySlice';
import paymentReducer from './store/slices/paymentSlice';
import productReducer from './store/slices/productSlice';
import syncReducer from './store/slices/syncSlice';

const PERSIST_KEY = 'pve_state_v1';

// Load persisted state
function loadPersistedState(): any | undefined {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// Persistence middleware
const persistMiddleware: any = (storeAPI: any) => (next: any) => (action: any) => {
  const result = next(action);
  try {
    const state = storeAPI.getState();
    const toPersist = {
      auth: state?.auth,
      products: state?.products,
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(toPersist));
  } catch {}
  return result;
};

const preloadedState = loadPersistedState();

export const store = configureStore({
  reducer: {
    auth: authReducer,

    // IMPORTANT: CANONICAL & STABLE NAMES (Fixes all undefined destructure errors!)
    banks: bankReducer,
    customers: customerReducer,
    dashboard: dashboardReducer,
    invoices: invoiceReducer,
    parties: partyReducer,
    payments: paymentReducer,
    products: productReducer,
    sync: syncReducer,
  },

  preloadedState,

  devTools: process.env.NODE_ENV !== 'production',

  middleware: (getDefaultMiddleware) =>
    ((getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['bank/importBankStatement/fulfilled', 'bank/exportBankStatement/fulfilled'],
      },
    }) as any).concat(persistMiddleware as any)),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
