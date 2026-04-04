import { StorageDriver } from './storageTypes';

const DB_NAME = 'pve_offline_store';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const isIndexedDbSupported = (): boolean => typeof indexedDB !== 'undefined';

const openDatabase = (): Promise<IDBDatabase> => {
  if (!isIndexedDbSupported()) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('Failed to open IndexedDB'));
    };
  });

  return dbPromise;
};

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = action(store);

    request.onsuccess = () => {
      resolve(request.result as T);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB transaction failed'));
    };
  });
};

export const indexedDbDriver: StorageDriver = {
  async read<T>(key: string): Promise<T | null> {
    try {
      return await runTransaction<T | null>('readonly', (store) => store.get(key));
    } catch (err) {
      console.warn('[storage] IndexedDB read fallback for key', key, err);
      return null;
    }
  },
  async write<T>(key: string, value: T): Promise<void> {
    try {
      await runTransaction('readwrite', (store) => store.put(value as IDBValidKey, key));
    } catch (err) {
      console.error('[storage] IndexedDB write failed, key:', key, err);
      throw err;
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await runTransaction('readwrite', (store) => store.delete(key));
    } catch (err) {
      console.error('[storage] IndexedDB remove failed, key:', key, err);
      throw err;
    }
  },
};

export const indexedDbSupport = {
  isSupported: isIndexedDbSupported,
};
