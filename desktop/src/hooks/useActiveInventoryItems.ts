import { useCallback, useEffect, useState } from 'react';
import {
  inventoryItemService,
  INVENTORY_ITEMS_CHANGED_EVENT,
} from '../services/masters/inventoryItemService';
import type { InventoryItem } from '../types/masters';

type Options = {
  /** When this value changes (e.g. picker open key), reload from storage. Pass `null` to skip. */
  reloadWhen?: unknown;
};

/**
 * Active inventory items shared across Items desk, sales/purchase vouchers, and pickers.
 * Stays in sync via INVENTORY_ITEMS_CHANGED_EVENT from inventoryItemService.
 */
export function useActiveInventoryItems(options?: Options) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const list = await inventoryItemService.list({ includeInactive: false });
      setItems(list.filter((item) => item.status === 'ACTIVE'));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = () => void reload();
    window.addEventListener(INVENTORY_ITEMS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(INVENTORY_ITEMS_CHANGED_EVENT, onChange);
  }, [reload]);

  useEffect(() => {
    if (options?.reloadWhen === undefined || options?.reloadWhen === null) return;
    void reload();
  }, [options?.reloadWhen, reload]);

  return { items, setItems, loading, reload };
}

/** Subscribe to inventory changes (e.g. master list refresh). */
export function useInventoryItemsChanged(onChange: () => void): void {
  useEffect(() => {
    const handler = () => onChange();
    window.addEventListener(INVENTORY_ITEMS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(INVENTORY_ITEMS_CHANGED_EVENT, handler);
  }, [onChange]);
}
