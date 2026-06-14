import AsyncStorage from '@react-native-async-storage/async-storage';

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const CACHE_KEYS = {
  items: 'cache_items',
  customers: 'cache_customers',
  suppliers: 'cache_suppliers',
  vouchersSales: 'cache_vouchers_sales',
  vouchersPurchase: 'cache_vouchers_purchase',
  vouchersReceipt: 'cache_vouchers_receipt',
  vouchersPayment: 'cache_vouchers_payment',
  vouchersJournal: 'cache_vouchers_journal',
  ledgers: 'cache_ledgers',
  dashboard: 'cache_dashboard',
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];
