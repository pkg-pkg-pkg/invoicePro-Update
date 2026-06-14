import { generateId } from '../../utils/id';
import { ensureSyncReady, shouldAttemptMiddlewareSync } from './middlewareSyncAuth';
import { syncElectronStore } from './syncElectronStore';
import type { CaptureDeltaParams, QueuedDeltaItem } from './syncDeltaTypes';
import { notifySyncStatusChanged } from './syncStatusEvents';

const ENTITY_TO_RECORD: Record<string, string> = {
  sales_voucher: 'invoice',
  sales_return: 'invoice',
  purchase_voucher: 'invoice',
  purchase_return: 'invoice',
  payment_voucher: 'receipt',
  receipt_voucher: 'receipt',
  journal_voucher: 'ledger',
  contra_voucher: 'ledger',
  customer: 'customer',
  supplier: 'customer', // stored in customers / parties on ipa
  item: 'item',
  product: 'item',
};

const OP_TO_ACTION: Record<string, QueuedDeltaItem['action']> = {
  upsert: 'update',
  delete: 'delete',
  insert: 'insert',
  update: 'update',
  CREATE: 'insert',
  UPDATE: 'update',
  DELETE: 'delete',
};

function extractRecordId(payload: Record<string, unknown>): string {
  const id = payload.id ?? payload.invoice_id ?? payload.customer_id ?? payload.item_id;
  return String(id || generateId('rec'));
}

let cachedDeviceId: string | null = null;

function getDeviceId(): string {
  if (!cachedDeviceId) {
    cachedDeviceId = generateId('device');
  }
  return cachedDeviceId;
}

export async function enqueueDelta(params: CaptureDeltaParams): Promise<void> {
  if (!(await shouldAttemptMiddlewareSync())) {
    return;
  }

  const ready = await ensureSyncReady();
  if (!ready) {
    console.warn('[middleware-sync] enqueue skipped — sync not ready', params.entity, params.operation);
    return;
  }

  const userUUID = (await syncElectronStore.getUserUUID()).trim();
  const ownerId = userUUID || params.userId;
  const item: QueuedDeltaItem = {
    queue_id: generateId('mdelta'),
    record_type: ENTITY_TO_RECORD[params.entity] ?? params.entity,
    record_id: extractRecordId(params.payload),
    action: OP_TO_ACTION[params.operation] ?? 'update',
    data: { ...params.payload, companyId: params.companyId },
    timestamp: new Date().toISOString(),
    device_id: getDeviceId(),
    user_id: ownerId,
    company_id: params.companyId,
  };

  const queue = await syncElectronStore.getDeltaQueue<QueuedDeltaItem>();
  queue.push(item);
  await syncElectronStore.setDeltaQueue(queue);
  console.log('[middleware-sync] enqueued delta', item.record_type, item.record_id, 'queue=', queue.length);
  notifySyncStatusChanged();
}
