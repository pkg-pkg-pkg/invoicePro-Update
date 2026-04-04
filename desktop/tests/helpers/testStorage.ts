import { storageDriver } from '../../src/services/storage/storageDriver';
import { StorageDriver } from '../../src/services/storage/storageTypes';

const memoryStore = new Map<string, any>();

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const memoryDriver: StorageDriver = {
  async read<T>(key: string) {
    if (!memoryStore.has(key)) return null;
    return deepClone(memoryStore.get(key)) as T;
  },
  async write<T>(key: string, value: T) {
    memoryStore.set(key, deepClone(value));
  },
  async remove(key: string) {
    memoryStore.delete(key);
  },
};

storageDriver.setDriver(memoryDriver);

export const resetTestStorage = () => {
  memoryStore.clear();
};
