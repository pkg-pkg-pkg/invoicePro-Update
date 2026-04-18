const KEY = 'pve_rate_memory_v1';

type Bucket = Record<string, number>;

type Store = {
  lastSaleExclusive: Bucket;
  lastPurchaseExclusive: Bucket;
};

const read = (): Store => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { lastSaleExclusive: {}, lastPurchaseExclusive: {} };
    const p = JSON.parse(raw) as Partial<Store>;
    return {
      lastSaleExclusive: p.lastSaleExclusive ?? {},
      lastPurchaseExclusive: p.lastPurchaseExclusive ?? {},
    };
  } catch {
    return { lastSaleExclusive: {}, lastPurchaseExclusive: {} };
  }
};

const write = (s: Store) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

const saleKey = (customerLedgerId: string, itemId: string) =>
  `${String(customerLedgerId || 'global')}::${String(itemId)}`;

const purchaseKey = (supplierLedgerId: string, itemId: string) =>
  `${String(supplierLedgerId || 'global')}::${String(itemId)}`;

export const rateMemory = {
  getLastSaleExclusive(customerLedgerId: string, itemId: string): number | null {
    const v = read().lastSaleExclusive[saleKey(customerLedgerId, itemId)];
    if (v == null || !Number.isFinite(v) || v <= 0) return null;
    return v;
  },

  setLastSaleExclusive(customerLedgerId: string, itemId: string, rateExclusive: number) {
    if (!itemId || !Number.isFinite(rateExclusive) || rateExclusive <= 0) return;
    const s = read();
    s.lastSaleExclusive[saleKey(customerLedgerId, itemId)] = Number(rateExclusive.toFixed(4));
    write(s);
  },

  getLastPurchaseExclusive(supplierLedgerId: string, itemId: string): number | null {
    const v = read().lastPurchaseExclusive[purchaseKey(supplierLedgerId, itemId)];
    if (v == null || !Number.isFinite(v) || v <= 0) return null;
    return v;
  },

  setLastPurchaseExclusive(supplierLedgerId: string, itemId: string, rateExclusive: number) {
    if (!itemId || !Number.isFinite(rateExclusive) || rateExclusive <= 0) return;
    const s = read();
    s.lastPurchaseExclusive[purchaseKey(supplierLedgerId, itemId)] = Number(rateExclusive.toFixed(4));
    write(s);
  },
};
