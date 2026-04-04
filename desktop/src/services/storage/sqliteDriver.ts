import { StorageDriver } from './storageTypes';

const hasElectron = () => typeof window !== 'undefined' && Boolean((window as any).electronAPI?.storageRead);

export const sqliteDriver: StorageDriver = {
  async read<T>(key: string): Promise<T | null> {
    if (!hasElectron()) return null;
    try {
      return await ((window as any).electronAPI.storageRead as <T>(key: string) => Promise<T | null>)(key);
    } catch (error) {
      console.warn('[sqliteDriver] read failed', error);
      return null;
    }
  },
  async write<T>(key: string, value: T): Promise<void> {
    if (!hasElectron()) return;
    try {
      await (window as any).electronAPI.storageWrite(key, value);
    } catch (error) {
      console.warn('[sqliteDriver] write failed', error);
    }
  },
  async remove(key: string): Promise<void> {
    if (!hasElectron()) return;
    try {
      await (window as any).electronAPI.storageRemove(key);
    } catch (error) {
      console.warn('[sqliteDriver] remove failed', error);
    }
  },
};

export const sqliteSupport = {
  isAvailable: hasElectron,
};
