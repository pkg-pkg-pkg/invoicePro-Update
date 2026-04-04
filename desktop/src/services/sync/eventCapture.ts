import { syncService } from './syncService';

const ENTITY_TYPE_MAP: Record<string, string> = {
  pve_ledger_groups: 'ledger_groups',
  pve_ledger_accounts: 'ledger_accounts',
  pve_inventory_items: 'inventory_items',
  pve_item_categories: 'item_categories',
  pve_units_of_measure: 'units_of_measure',
  pve_godowns: 'godowns',
  pve_vouchers: 'vouchers',
  pve_ledger_transactions: 'ledger_transactions',
};

const APPEND_ONLY_ENTITIES = new Set(['vouchers', 'ledger_transactions']);

export const captureCreate = async (
  storageKey: string,
  record: { id: string; updatedAt?: string; createdAt?: string; [key: string]: unknown }
): Promise<void> => {
  const entityType = ENTITY_TYPE_MAP[storageKey];
  if (!entityType) return;

  const version = record.updatedAt ?? record.createdAt ?? new Date().toISOString();
  await syncService.capture(entityType, record.id, 'CREATE', record, version);
};

export const captureUpdate = async (
  storageKey: string,
  record: { id: string; updatedAt?: string; [key: string]: unknown }
): Promise<void> => {
  const entityType = ENTITY_TYPE_MAP[storageKey];
  if (!entityType) return;

  if (APPEND_ONLY_ENTITIES.has(entityType)) {
    console.log('[eventCapture] skipping UPDATE for append-only entity', entityType);
    return;
  }

  const version = record.updatedAt ?? new Date().toISOString();
  await syncService.capture(entityType, record.id, 'UPDATE', record, version);
};

export const captureDelete = async (
  storageKey: string,
  recordId: string,
  softDeletePayload?: { id: string; isActive?: boolean; status?: string; updatedAt?: string }
): Promise<void> => {
  const entityType = ENTITY_TYPE_MAP[storageKey];
  if (!entityType) return;

  if (APPEND_ONLY_ENTITIES.has(entityType)) {
    console.log('[eventCapture] skipping DELETE for append-only entity', entityType);
    return;
  }

  const version = softDeletePayload?.updatedAt ?? new Date().toISOString();
  await syncService.capture(entityType, recordId, 'DELETE', softDeletePayload ?? { id: recordId }, version);
};

export const eventCapture = {
  create: captureCreate,
  update: captureUpdate,
  delete: captureDelete,
};
