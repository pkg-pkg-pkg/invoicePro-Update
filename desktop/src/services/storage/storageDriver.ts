import { ensureJsonParse } from '../../utils/storageUtils';
import { indexedDbDriver, indexedDbSupport } from './indexedDbDriver';
import { sqliteDriver, sqliteSupport } from './sqliteDriver';
import { StorageDriver } from './storageTypes';

const readFromLocalStorage = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return ensureJsonParse<T | null>(raw, null);
  } catch {
    return null;
  }
};

const writeToLocalStorage = async <T>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const removeFromLocalStorage = async (key: string) => {
  localStorage.removeItem(key);
};

export const localStorageDriver: StorageDriver = {
  async read<T>(key: string) {
    return readFromLocalStorage<T>(key);
  },
  async write<T>(key: string, value: T) {
    await writeToLocalStorage(key, value);
  },
  async remove(key: string) {
    await removeFromLocalStorage(key);
  },
};

type DriverPreference = 'indexeddb' | 'localstorage';

const resolveDriverPreference = (): DriverPreference => {
  try {
    const rawPreference = (import.meta as any)?.env?.VITE_STORAGE_DRIVER;
    const normalized = typeof rawPreference === 'string' ? rawPreference.toLowerCase() : 'indexeddb';
    return normalized === 'localstorage' ? 'localstorage' : 'indexeddb';
  } catch {
    return 'indexeddb';
  }
};

const pickInitialDriver = (): StorageDriver => {
  if (sqliteSupport.isAvailable()) {
    return sqliteDriver;
  }
  const preference = resolveDriverPreference();
  if (preference === 'indexeddb' && indexedDbSupport.isSupported()) {
    return indexedDbDriver;
  }
  if (preference === 'indexeddb' && !indexedDbSupport.isSupported()) {
    console.warn('[storage] IndexedDB not supported, falling back to localStorage driver');
  }
  return localStorageDriver;
};

let activeDriver: StorageDriver = pickInitialDriver();

export const storageDriver = {
  getDriver() {
    return activeDriver;
  },
  setDriver(driver: StorageDriver) {
    activeDriver = driver;
  },
  async read<T>(key: string, fallback: T): Promise<T> {
    const data = await activeDriver.read<T>(key);
    return data ?? fallback;
  },
  async write<T>(key: string, value: T) {
    await activeDriver.write(key, value);
  },
  async remove(key: string) {
    await activeDriver.remove(key);
  },
};
