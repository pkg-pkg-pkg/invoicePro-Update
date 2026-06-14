import { isElectronRuntime } from '../../utils/runtime';
import { ensureSyncReady, shouldAttemptMiddlewareSync } from './middlewareSyncAuth';
import { syncElectronStore } from './syncElectronStore';
import type { DrainQueueResult, QueuedDeltaItem } from './syncDeltaTypes';
import { notifySyncStatusChanged } from './syncStatusEvents';

let draining = false;

export function isDrainInProgress(): boolean {
  return draining;
}

export async function drainQueue(): Promise<DrainQueueResult> {
  const result: DrainQueueResult = { attempted: 0, succeeded: 0, failed: 0 };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.warn('[middleware-sync] drain skipped — offline');
    return result;
  }

  if (!(await shouldAttemptMiddlewareSync())) {
    return result;
  }

  const ready = await ensureSyncReady();
  if (!ready) {
    console.warn('[middleware-sync] drain aborted — sync not ready');
    return result;
  }

  const apiUrl = (await syncElectronStore.getMiddlewareUrl()).replace(/\/$/, '');
  if (!apiUrl) {
    console.warn('[middleware-sync] drain skipped — no middlewareUrl');
    return result;
  }

  const jwt = (await syncElectronStore.getJwtToken()).trim();
  if (!jwt) {
    console.warn('[middleware-sync] syncJwtToken not set, skipping push');
    return result;
  }

  if (draining) return result;
  draining = true;
  notifySyncStatusChanged();

  try {
    const queue = await syncElectronStore.getDeltaQueue<QueuedDeltaItem>();
    console.log('[middleware-sync] drain starting, queue depth=', queue.length);
    const remaining: QueuedDeltaItem[] = [];
    let stopped = false;

    for (const item of queue) {
      if (stopped) {
        remaining.push(item);
        continue;
      }

      result.attempted++;
      const { queue_id: _q, company_id: _c, ...payload } = item;

      try {
        console.log('Pushing delta to ipa...', payload.record_type, payload.record_id);
        console.log('[middleware-sync] JWT prefix:', `${jwt.slice(0, 20)}…`);
        console.log('[middleware-sync] POST', `${apiUrl}/api/sync/push`);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        };

        const res = await fetch(`${apiUrl}/api/sync/push`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ deltas: [payload] }),
        });

        const bodyText = await res.text().catch(() => '');
        console.log(`Push ${res.ok ? 'success' : 'failed'}: ${res.status}`, bodyText.slice(0, 200));

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${bodyText}`);
        result.succeeded++;
      } catch (err) {
        result.failed++;
        remaining.push(item);
        stopped = true;
        console.warn('[middleware-sync] drain stopped on failure:', err);
      }
    }

    await syncElectronStore.setDeltaQueue(remaining);

    if (result.succeeded > 0) {
      await syncElectronStore.setLastSyncedAt(new Date().toISOString());
    }

    console.info('[middleware-sync] drain result:', result);
    return result;
  } finally {
    draining = false;
    notifySyncStatusChanged();
  }
}

let listenersBound = false;

export function initDrainListeners(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;

  const triggerDrain = () => {
    void drainQueue().catch((err) => console.warn('[middleware-sync] drain error:', err));
  };

  window.addEventListener('online', triggerDrain);

  if (isElectronRuntime() && window.electronAPI?.onNetworkOnline) {
    window.electronAPI.onNetworkOnline(triggerDrain);
  }
}

let postLoginTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePostLoginDrain(): void {
  if (postLoginTimer) clearTimeout(postLoginTimer);
  postLoginTimer = setTimeout(() => {
    void drainQueue().catch((err) => console.warn('[middleware-sync] post-login drain:', err));
  }, 5000);
}
