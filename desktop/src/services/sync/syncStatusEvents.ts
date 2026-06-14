import { SYNC_STATUS_CHANGED } from './syncDeltaTypes';

export function notifySyncStatusChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_STATUS_CHANGED));
  }
}
