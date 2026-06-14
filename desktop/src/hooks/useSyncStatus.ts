import { useCallback, useEffect, useState } from 'react';
import { getSyncStatus } from '../services/sync/invoiceProMiddlewareSync';
import type { SyncStatusSnapshot } from '../services/sync/syncDeltaTypes';
import { SYNC_STATUS_CHANGED } from '../services/sync/syncDeltaTypes';

const EMPTY: SyncStatusSnapshot = {
  state: 'off',
  pendingCount: 0,
  lastSyncedAt: null,
  syncEnabled: false,
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short' });
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatusSnapshot>(EMPTY);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getSyncStatus());
    } catch {
      setStatus(EMPTY);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(SYNC_STATUS_CHANGED, onChange);
    window.addEventListener('online', onChange);
    const interval = setInterval(onChange, 15000);
    return () => {
      window.removeEventListener(SYNC_STATUS_CHANGED, onChange);
      window.removeEventListener('online', onChange);
      clearInterval(interval);
    };
  }, [refresh]);

  return {
    ...status,
    lastSyncedLabel: formatRelativeTime(status.lastSyncedAt),
    refresh,
  };
}
