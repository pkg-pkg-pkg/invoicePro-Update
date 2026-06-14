import { getActiveCompanyId } from '../../utils/companyStorage';
import type { CaptureDeltaParams } from './syncDeltaTypes';
import { enqueueDelta } from './syncDeltaCapture';
import { drainQueue } from './syncQueueDrain';

function getCurrentUserId(): string {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    const user = JSON.parse(raw) as { id?: string };
    return String(user?.id ?? '').trim();
  } catch {
    return '';
  }
}

/** Fire-and-forget delta capture — never blocks UI or surfaces errors. */
export function fireAndForgetDelta(
  partial: Omit<CaptureDeltaParams, 'companyId' | 'userId'> & {
    companyId?: string;
    userId?: string;
  }
): void {
  console.log('captureDelta called:', partial.entity, partial.operation);
  try {
    const params: CaptureDeltaParams = {
      entity: partial.entity,
      operation: partial.operation,
      payload: partial.payload,
      companyId: partial.companyId ?? getActiveCompanyId(),
      userId: partial.userId ?? getCurrentUserId(),
    };
    void enqueueDelta(params)
      .then(() => drainQueue())
      .catch((err) => console.warn('[middleware-sync] captureDelta failed:', err));
  } catch (err) {
    console.warn('[middleware-sync] captureDelta error:', err);
  }
}
