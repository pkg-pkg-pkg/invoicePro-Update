// src/store.ts - CLEAN VERSION
import { configureStore } from '@reduxjs/toolkit';

// Slices
import authReducer from './store/slices/authSlice';
import bankReducer from './store/slices/bankSlice';
import dashboardReducer from './store/slices/dashboardSlice';
import expenseReducer from './store/slices/expenseSlice';
import invoiceReducer from './store/slices/invoiceSlice';
import partyReducer from './store/slices/partySlice';
import paymentReducer from './store/slices/paymentSlice';
import productReducer from './store/slices/productSlice';
import schemeReducer from './store/slices/schemeSlice';
import syncReducer from './store/slices/syncSlice';
import userManagementReducer from './store/slices/userManagementSlice';


// Note: Persistence middleware temporarily disabled due to type conflicts
// Will be re-enabled once type issues are resolved

export const store = configureStore({
  reducer: {
    auth: authReducer,
    userManagement: userManagementReducer,
    banks: bankReducer,
    dashboard: dashboardReducer,
    expenses: expenseReducer,
    invoices: invoiceReducer,
    parties: partyReducer,
    payments: paymentReducer,
    products: productReducer,
    schemes: schemeReducer,
    sync: syncReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;