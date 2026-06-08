import { store } from '../../store';
import { setSyncStatus } from '../../store/slices/syncSlice';
import { readOutbox, readSyncConfig, writeOutbox, writeSyncConfig } from './storage';
import { MobileSyncConfig, MobileSyncEnvelope, MobileSyncEntityType } from './types';
import { getMobileDeviceId } from '../deviceService';
import { fetchDesktopSnapshot } from '../mobileDesktopAuthService';

type WorkerState = {
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
};

const state: WorkerState = {
  timer: null,
  running: false,
};

function buildAuthHeaders(config: MobileSyncConfig) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.token.trim()) {
    headers.Authorization = `Bearer ${config.token.trim()}`;
    headers['X-Sync-Token'] = config.token.trim();
  }
  if (config.sessionToken?.trim()) {
    headers['X-Mobile-Session'] = config.sessionToken.trim();
  }
  return headers;
}

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function syncUpload(config: MobileSyncConfig, pending: MobileSyncEnvelope[]) {
  if (pending.length === 0) {
    return {
      acceptedKeys: new Set<string>(),
      duplicateKeys: new Set<string>(),
      rejectedKeys: new Map<string, string>(),
    };
  }
  const deviceId = config.deviceId || (await getMobileDeviceId());
  const response = await fetch(`${config.endpointBase}/upload`, {
    method: 'POST',
    headers: buildAuthHeaders(config),
    body: JSON.stringify({
      deviceId,
      events: pending.map((event) => ({
        idempotencyKey: event.idempotencyKey,
        entityType: event.entityType,
        operation: event.operation,
        payload: event.payload,
        timestamp: event.timestamp,
      })),
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Upload failed (${response.status})`);
  }
  const payload = await response.json();
  return {
    acceptedKeys: new Set<string>((payload.accepted || []).map((x: any) => String(x.idempotencyKey))),
    duplicateKeys: new Set<string>((payload.duplicates || []).map((x: any) => String(x.idempotencyKey))),
    rejectedKeys: new Map<string, string>(
      (payload.rejected || []).map((x: any) => [String(x.idempotencyKey || ''), String(x.reason || 'Rejected')])
    ),
  };
}

async function syncDownload(config: MobileSyncConfig) {
  const response = await fetch(`${config.endpointBase}/download?cursor=${config.cursor}&limit=100`, {
    method: 'GET',
    headers: buildAuthHeaders(config),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Download failed (${response.status})`);
  }
  return response.json();
}

function scheduleNextAttempt(attempts: number) {
  const base = Math.min(60_000, 1_000 * Math.pow(2, attempts));
  const jitter = Math.floor(Math.random() * 500);
  return Date.now() + base + jitter;
}

async function flushOnce() {
  const config = await readSyncConfig();
  const queue = await readOutbox();
  const ready = queue.filter((event) => event.status !== 'synced' && event.nextAttemptAt <= Date.now());

  store.dispatch(
    setSyncStatus({
      isSyncing: true,
      pendingChanges: queue.filter((event) => event.status !== 'synced').length,
      endpointBase: config.endpointBase,
      lastError: null,
    })
  );

  const uploadResult = await syncUpload(config, ready);
  const afterUpload: MobileSyncEnvelope[] = queue.map((event): MobileSyncEnvelope => {
    const key = event.idempotencyKey;
    if (uploadResult.acceptedKeys?.has(key) || uploadResult.duplicateKeys?.has(key)) {
      return { ...event, status: 'synced', lastError: null };
    }
    if (uploadResult.rejectedKeys?.has(key)) {
      const attempts = event.attempts + 1;
      return {
        ...event,
        status: 'failed',
        attempts,
        lastError: uploadResult.rejectedKeys.get(key) || 'Rejected',
        nextAttemptAt: scheduleNextAttempt(attempts),
      };
    }
    return event;
  });
  await writeOutbox(afterUpload);

  const downloadPayload = await syncDownload(config);
  const nextCursor = Number(downloadPayload?.nextCursor || config.cursor || 0);
  await writeSyncConfig({ ...config, cursor: nextCursor });

  let snapshot: Record<string, unknown> | null = null;
  if (config.sessionToken?.trim()) {
    snapshot = await fetchDesktopSnapshot();
  }

  const pending = afterUpload.filter((event) => event.status !== 'synced').length;
  store.dispatch(
    setSyncStatus({
      isSyncing: false,
      lastSyncAt: nowIso(),
      pendingChanges: pending,
      lastError: null,
      endpointBase: config.endpointBase,
      snapshot: snapshot ?? undefined,
    })
  );
}

async function guardedFlush() {
  try {
    await flushOnce();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const queue = await readOutbox();
  const next: MobileSyncEnvelope[] = queue.map((event): MobileSyncEnvelope => {
      if (event.status === 'synced') return event;
      const attempts = event.attempts + 1;
      return {
        ...event,
        status: 'failed',
        attempts,
        lastError: message,
        nextAttemptAt: scheduleNextAttempt(attempts),
      };
    });
    await writeOutbox(next);
    store.dispatch(
      setSyncStatus({
        isSyncing: false,
        lastError: message,
        pendingChanges: next.filter((event) => event.status !== 'synced').length,
      })
    );
  }
}

export const mobileSyncWorker = {
  async configure(configPatch: Partial<MobileSyncConfig>) {
    const current = await readSyncConfig();
    const next: MobileSyncConfig = {
      endpointBase: configPatch.endpointBase || current.endpointBase,
      token: configPatch.token ?? current.token,
      cursor: typeof configPatch.cursor === 'number' ? configPatch.cursor : current.cursor,
      sessionToken: configPatch.sessionToken ?? current.sessionToken,
      deviceId: configPatch.deviceId ?? current.deviceId,
    };
    await writeSyncConfig(next);
    store.dispatch(setSyncStatus({ endpointBase: next.endpointBase }));
  },

  async enqueueCreate(entityType: MobileSyncEntityType, payload: Record<string, unknown>) {
    const event: MobileSyncEnvelope = {
      id: generateId('evt'),
      idempotencyKey: generateId('idem'),
      entityType,
      operation: 'CREATE',
      payload,
      timestamp: nowIso(),
      status: 'pending',
      attempts: 0,
      nextAttemptAt: Date.now(),
      lastError: null,
    };
    const queue = await readOutbox();
    queue.push(event);
    await writeOutbox(queue);
    store.dispatch(setSyncStatus({ pendingChanges: queue.filter((e) => e.status !== 'synced').length }));
    await guardedFlush();
    return event;
  },

  async retryNow() {
    await guardedFlush();
  },

  async getRuntimeStatus() {
    const queue = await readOutbox();
    const config = await readSyncConfig();
    return {
      pendingChanges: queue.filter((event) => event.status !== 'synced').length,
      endpointBase: config.endpointBase,
      tokenConfigured: Boolean(config.token),
      cursor: config.cursor,
      running: state.running,
    };
  },

  start() {
    if (state.running) return;
    state.running = true;
    state.timer = setInterval(() => {
      void guardedFlush();
    }, 8000);
    void guardedFlush();
  },

  stop() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    state.running = false;
  },
};
