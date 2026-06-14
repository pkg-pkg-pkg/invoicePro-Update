import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { store } from '../../store';
import { setSyncStatus } from '../../store/slices/syncSlice';
import {
  apiSyncFetch,
  apiSyncPush,
  SyncPushPayload,
  SyncRecord,
} from '../api/invoiceProClient';
import { MobileSyncEntityType } from './types';

const QUEUE_KEY = 'mobileQueue';
const LAST_FETCHED_KEY = 'lastFetchedAt';
const LOCAL_DATA_KEY = 'pve_mobile_sync_data';
const PARTY_CACHE_KEY = 'pve_mobile_party_cache';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export type MobileQueueItem = {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  version?: number;
  timestamp: string;
  source: 'mobile';
};

type WorkerState = {
  intervalId: ReturnType<typeof setInterval> | null;
  appStateSubscription: ReturnType<typeof AppState.addEventListener> | null;
  netInfoUnsubscribe: (() => void) | null;
  appState: AppStateStatus;
  running: boolean;
};

const state: WorkerState = {
  intervalId: null,
  appStateSubscription: null,
  netInfoUnsubscribe: null,
  appState: AppState.currentState,
  running: false,
};

function nowIso(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readQueue(): Promise<MobileQueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as MobileQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: MobileQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

async function readLastFetchedAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_FETCHED_KEY);
}

async function writeLastFetchedAt(value: string): Promise<void> {
  await AsyncStorage.setItem(LAST_FETCHED_KEY, value);
}

type LocalDataStore = Record<string, Record<string, unknown>[]>;

async function readLocalData(): Promise<LocalDataStore> {
  const raw = await AsyncStorage.getItem(LOCAL_DATA_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as LocalDataStore;
  } catch {
    return {};
  }
}

async function writeLocalData(data: LocalDataStore): Promise<void> {
  await AsyncStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(data));
}

async function applyRecordToPartyCache(record: SyncRecord): Promise<void> {
  const entityType = record.entityType.toLowerCase();
  if (!entityType.includes('customer') && !entityType.includes('supplier') && entityType !== 'ledger') {
    return;
  }

  const payload = record.payload;
  const kind =
    entityType.includes('supplier') || payload.kind === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER';
  const name = String(payload.name || payload.partyName || '');
  if (!name) return;

  const raw = await AsyncStorage.getItem(PARTY_CACHE_KEY);
  let cache: Array<{ id: string; name: string; phone?: string; kind: 'CUSTOMER' | 'SUPPLIER' }> = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      cache = Array.isArray(parsed) ? parsed : [];
    } catch {
      cache = [];
    }
  }

  const party = {
    id: record.entityId,
    name,
    phone: payload.phone ? String(payload.phone) : undefined,
    kind: kind as 'CUSTOMER' | 'SUPPLIER',
  };

  const idx = cache.findIndex((p) => p.id === party.id);
  if (record.operation === 'DELETE') {
    if (idx >= 0) cache.splice(idx, 1);
  } else if (idx >= 0) {
    cache[idx] = party;
  } else {
    cache.push(party);
  }

  await AsyncStorage.setItem(PARTY_CACHE_KEY, JSON.stringify(cache.slice(-1000)));
}

async function applyRecord(record: SyncRecord): Promise<void> {
  const data = await readLocalData();
  const bucket = data[record.entityType] ?? [];
  const items = Array.isArray(bucket) ? [...bucket] : [];
  const idx = items.findIndex((item) => String(item.id) === record.entityId);

  if (record.operation === 'DELETE') {
    if (idx >= 0) {
      items.splice(idx, 1);
    }
  } else if (record.operation === 'UPDATE') {
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...record.payload, id: record.entityId };
    } else {
      items.push({ ...record.payload, id: record.entityId });
    }
  } else {
    if (idx < 0) {
      items.push({ ...record.payload, id: record.entityId });
    }
  }

  data[record.entityType] = items;
  await writeLocalData(data);
  await applyRecordToPartyCache(record);
}

export async function pushLocalChanges(): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;

  const remaining: MobileQueueItem[] = [];

  for (const item of queue) {
    const payload: SyncPushPayload = {
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      payload: item.payload,
      version: item.version,
      timestamp: item.timestamp,
      source: item.source,
    };
    try {
      await apiSyncPush(payload);
    } catch {
      remaining.push(item);
    }
  }

  await writeQueue(remaining);
  store.dispatch(
    setSyncStatus({
      pendingChanges: remaining.length,
    })
  );
}

export async function fetchRemoteChanges(): Promise<void> {
  const since = await readLastFetchedAt();
  const response = await apiSyncFetch(since ?? undefined);
  const records = response.records ?? response.changes ?? [];

  for (const record of records) {
    await applyRecord(record);
  }

  const nextFetchedAt = response.lastFetchedAt ?? nowIso();
  await writeLastFetchedAt(nextFetchedAt);
}

export async function syncNow(): Promise<void> {
  store.dispatch(setSyncStatus({ isSyncing: true, lastError: null }));
  try {
    await pushLocalChanges();
    await fetchRemoteChanges();
    store.dispatch(
      setSyncStatus({
        isSyncing: false,
        lastSyncAt: nowIso(),
        lastError: null,
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const queue = await readQueue();
    store.dispatch(
      setSyncStatus({
        isSyncing: false,
        lastError: message,
        pendingChanges: queue.length,
      })
    );
  }
}

export type EnqueueResult = MobileQueueItem & { idempotencyKey: string };

export const middlewareSync = {
  async enqueueCreate(
    entityType: MobileSyncEntityType,
    payload: Record<string, unknown>
  ): Promise<EnqueueResult> {
    const item: MobileQueueItem = {
      id: generateId('evt'),
      entityType,
      entityId: generateId('ent'),
      operation: 'CREATE',
      payload,
      timestamp: nowIso(),
      source: 'mobile',
    };
    const queue = await readQueue();
    queue.push(item);
    await writeQueue(queue);
    store.dispatch(setSyncStatus({ pendingChanges: queue.length }));
    void syncNow();
    return { ...item, idempotencyKey: item.id };
  },

  syncNow,

  async retryNow(): Promise<void> {
    await syncNow();
  },

  async getRuntimeStatus() {
    const queue = await readQueue();
    const lastFetchedAt = await readLastFetchedAt();
    return {
      pendingChanges: queue.length,
      lastFetchedAt,
      running: state.running,
    };
  },

  startAutoSync(): void {
    if (state.running) return;
    state.running = true;

    state.appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = state.appState.match(/inactive|background/);
      state.appState = nextState;
      if (wasBackground && nextState === 'active') {
        void syncNow();
      }
    });

    state.intervalId = setInterval(() => {
      if (state.appState === 'active') {
        void syncNow();
      }
    }, SYNC_INTERVAL_MS);

    state.netInfoUnsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
      if (netState.isConnected && netState.isInternetReachable !== false) {
        void syncNow();
      }
    });

    void syncNow();
  },

  stopAutoSync(): void {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    state.appStateSubscription?.remove();
    state.appStateSubscription = null;
    state.netInfoUnsubscribe?.();
    state.netInfoUnsubscribe = null;
    state.running = false;
  },
};
