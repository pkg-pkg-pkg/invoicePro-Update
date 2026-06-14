import { store } from '../../store';
import { setSyncStatus } from '../../store/slices/syncSlice';
import { MobileSyncConfig, MobileSyncEntityType } from './types';

// LEGACY: disabled — desktop-tethered sync replaced by middlewareSync (invoicepro-api).
// Original LAN/desktop HTTP sync implementation preserved below for reference.

type WorkerState = {
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
};

const state: WorkerState = {
  timer: null,
  running: false,
};

export const mobileSyncWorker = {
  async configure(_configPatch: Partial<MobileSyncConfig>) {
    // LEGACY: disabled
    return;
    /*
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
    */
  },

  async enqueueCreate(_entityType: MobileSyncEntityType, _payload: Record<string, unknown>) {
    // LEGACY: disabled — use middlewareSync.enqueueCreate instead
    throw new Error('Desktop-tethered sync is disabled. Use middlewareSync.');
    /*
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
    */
  },

  async retryNow() {
    // LEGACY: disabled
    return;
  },

  async getRuntimeStatus() {
    // LEGACY: disabled
    return {
      pendingChanges: 0,
      endpointBase: '',
      tokenConfigured: false,
      cursor: 0,
      running: false,
    };
  },

  start() {
    // LEGACY: disabled — mobileSyncWorker no longer polls desktop :3399/mobile-sync
    if (state.running) return;
    state.running = false;
    /*
    state.running = true;
    state.timer = setInterval(() => {
      void guardedFlush();
    }, 8000);
    void guardedFlush();
    */
  },

  stop() {
    // LEGACY: disabled
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    state.running = false;
    store.dispatch(setSyncStatus({ isSyncing: false }));
  },
};
