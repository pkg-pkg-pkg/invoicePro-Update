import { storageDriver } from '../storage/storageDriver';
import { captureCreate, captureUpdate, captureDelete } from '../sync/eventCapture';
import { auditService } from '../audit/auditService';

export const nowIso = () => new Date().toISOString();

export const readList = async <T>(key: string): Promise<T[]> => {
  const data = await storageDriver.read<T[]>(key, [] as T[]);
  return Array.isArray(data) ? data : [];
};

export const writeList = async <T extends { id: string; updatedAt?: string; createdAt?: string; isActive?: boolean; status?: string }>(
  key: string,
  list: T[],
  options?: { skipSync?: boolean }
): Promise<void> => {
  if (!options?.skipSync) {
    try {
      const oldList = await readList<T>(key);
      const oldMap = new Map(oldList.map((item) => [item.id, item]));

      const entityType = key.replace('pve_', '');

      for (const item of list) {
        const old = oldMap.get(item.id);
        if (!old) {
          await captureCreate(key, item);
          await auditService.logCreate(entityType, item.id);
        } else {
          const oldUpdated = old.updatedAt ?? '';
          const newUpdated = item.updatedAt ?? '';
          if (newUpdated > oldUpdated) {
            const wasActive = old.isActive !== false && old.status !== 'INACTIVE';
            const isNowInactive = item.isActive === false || item.status === 'INACTIVE';
            if (wasActive && isNowInactive) {
              await captureDelete(key, item.id, item);
              await auditService.logDelete(entityType, item.id);
            } else {
              await captureUpdate(key, item);
              await auditService.logUpdate(entityType, item.id);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[storageHelpers] sync capture error', err);
    }
  }

  await storageDriver.write(key, list);
};

export const sanitizeString = (value?: string | null) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const assertCondition = (condition: unknown, message: string): asserts condition => {
  if (!condition) {
    throw new Error(message);
  }
};
