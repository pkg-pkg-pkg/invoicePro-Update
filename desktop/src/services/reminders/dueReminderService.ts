import { companyScopedKey, readCompanyScopedRaw } from '../../utils/companyStorage';

type VoucherLike = {
  id: string;
  type: string;
  number: string;
  date: string;
  narration?: string;
  status?: string;
  lines?: Array<{ ledgerId?: string; debit?: number; credit?: number }>;
};

type LedgerLike = { id: string; name?: string };

const VOUCHERS_STORAGE_KEY = companyScopedKey('pve_vouchers');
const LEDGERS_STORAGE_KEY = companyScopedKey('pve_ledger_accounts');

export interface DueReminder {
  voucherId: string;
  voucherNumber: string;
  voucherType: 'SALES' | 'PURCHASE';
  partyLedgerId: string;
  partyName: string;
  dueDate: string;
  balanceAmount: number;
  daysLeft: number;
}

const parseDueDateToken = (narration?: string): string | undefined => {
  if (!narration) return undefined;
  const m = String(narration).match(/DUE\[(\d{4}-\d{2}-\d{2})\]/i);
  return m?.[1];
};

const parseInvoiceAllocations = (narration?: string): Record<string, number> => {
  const map: Record<string, number> = {};
  if (!narration) return map;
  const re = /INVALLOC\[(.+?)\]=(\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(narration))) {
    const invoiceNumber = String(match[1] || '').trim();
    const amount = Number(match[2] || 0);
    if (!invoiceNumber || Number.isNaN(amount)) continue;
    map[invoiceNumber] = (map[invoiceNumber] ?? 0) + amount;
  }
  return map;
};

const startOfDayTs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export const dueReminderService = {
  listUpcoming(daysAhead = 7): DueReminder[] {
    try {
      const vouchers = JSON.parse(
        readCompanyScopedRaw('pve_vouchers') ?? localStorage.getItem(VOUCHERS_STORAGE_KEY) ?? '[]'
      ) as VoucherLike[];
      const ledgers = JSON.parse(
        readCompanyScopedRaw('pve_ledger_accounts') ?? localStorage.getItem(LEDGERS_STORAGE_KEY) ?? '[]'
      ) as LedgerLike[];
      const ledgerNameMap = new Map<string, string>(ledgers.map((l) => [String(l.id || ''), String(l.name || '')]));
      const active = vouchers.filter((v) => v && (v.status ?? 'ACTIVE') === 'ACTIVE');
      const today = new Date();
      const todayTs = startOfDayTs(today);
      const rows: DueReminder[] = [];

      for (const voucher of active) {
        if (voucher.type !== 'SALES' && voucher.type !== 'PURCHASE') continue;
        const partyLine =
          voucher.type === 'SALES'
            ? voucher.lines?.find((line) => Number(line?.debit || 0) > 0)
            : voucher.lines?.find((line) => Number(line?.credit || 0) > 0);
        if (!partyLine?.ledgerId) continue;
        const totalAmount = voucher.type === 'SALES' ? Number(partyLine.debit || 0) : Number(partyLine.credit || 0);
        if (totalAmount <= 0) continue;

        const paymentType = voucher.type === 'SALES' ? 'RECEIPT' : 'PAYMENT';
        const against = active.filter((p) => p.type === paymentType && String(p.narration || '').includes(String(voucher.number || '')));
        const paid = against.reduce((sum, p) => {
          const alloc = parseInvoiceAllocations(p.narration);
          if (Object.keys(alloc).length > 0) return sum + Number(alloc[String(voucher.number)] || 0);
          const line = p.lines?.find((x) => String(x?.ledgerId || '') === String(partyLine.ledgerId || ''));
          return sum + Number(line?.credit || line?.debit || 0);
        }, 0);
        const balance = Number((totalAmount - paid).toFixed(2));
        if (balance <= 0.01) continue;

        const dueDateRaw = parseDueDateToken(voucher.narration) || String(voucher.date || '').slice(0, 10);
        const dueDate = String(dueDateRaw).slice(0, 10);
        const dueTs = startOfDayTs(new Date(dueDate));
        if (!Number.isFinite(dueTs)) continue;
        const daysLeft = Math.ceil((dueTs - todayTs) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0 || daysLeft > daysAhead) continue;

        rows.push({
          voucherId: String(voucher.id),
          voucherNumber: String(voucher.number || ''),
          voucherType: voucher.type as 'SALES' | 'PURCHASE',
          partyLedgerId: String(partyLine.ledgerId),
          partyName: ledgerNameMap.get(String(partyLine.ledgerId)) || String(partyLine.ledgerId),
          dueDate,
          balanceAmount: balance,
          daysLeft,
        });
      }

      return rows.sort((a, b) => a.daysLeft - b.daysLeft || a.partyName.localeCompare(b.partyName));
    } catch {
      return [];
    }
  },
};

