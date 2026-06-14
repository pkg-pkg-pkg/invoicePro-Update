import { LedgerAccount, LedgerTransaction } from '../../types/masters';
import type { Voucher } from '../../types/vouchers';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { ledgerTransactionService } from '../masters/ledgerTransactionService';
import { voucherService } from '../vouchers/voucherService';
export interface LedgerStatementFilters {
  fromDate?: string;
  toDate?: string;
}

export interface LedgerStatementEntry extends LedgerTransaction {
  runningBalance: number;
}

export interface LedgerStatement {
  ledger: LedgerAccount;
  openingBalance: number;
  closingBalance: number;
  transactions: LedgerStatementEntry[];
}

const parseDateOrThrow = (value?: string): number | null => {
  if (!value) {
    return null;
  }
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) {
    throw new Error('Invalid date provided');
  }
  return ts;
};

const isBefore = (timestamp: number, boundary: number | null) =>
  boundary !== null && timestamp < boundary;

const isAfter = (timestamp: number, boundary: number | null) =>
  boundary !== null && timestamp > boundary;

const computeLedgerOpening = (
  ledger: LedgerAccount,
  transactions: LedgerTransaction[],
  fromTs: number | null
) => {
  let opening =
    ledger.openingBalanceType === 'DEBIT'
      ? ledger.openingBalance
      : -ledger.openingBalance;

  if (fromTs === null) {
    return opening;
  }

  for (const txn of transactions) {
    const txnTs = Date.parse(txn.date);
    if (!Number.isNaN(txnTs) && txnTs < fromTs) {
      opening += txn.debit - txn.credit;
    }
  }

  return Number(opening.toFixed(4));
};

/** Ledgers with the same name in the same group (duplicate sundry accounts). */
async function resolveRelatedLedgerIds(primaryLedgerId: string): Promise<string[]> {
  const ledger = await ledgerAccountService.getById(primaryLedgerId);
  if (!ledger) return [primaryLedgerId];

  const ledgers = await ledgerAccountService.list({
    includeInactive: false,
    groupId: ledger.groupId,
  });
  const nameKey = ledger.name.trim().toLowerCase();
  const related = ledgers.filter((l) => l.name.trim().toLowerCase() === nameKey).map((l) => l.id);
  return related.length ? related : [primaryLedgerId];
}

/** Build ledger rows from posted vouchers — source of truth for party ledger display. */
async function buildTransactionsFromVouchers(
  ledgerIds: string[],
  vouchers?: Voucher[]
): Promise<LedgerTransaction[]> {
  const allVouchers = vouchers ?? (await voucherService.list({ includeDeleted: true }));
  const ledgerSet = new Set(ledgerIds);
  const rows: LedgerTransaction[] = [];

  for (const voucher of allVouchers) {
    if ((voucher.status ?? 'ACTIVE') === 'CANCELLED') continue;
    voucher.lines.forEach((line, lineIndex) => {
      if (!line.ledgerId || !ledgerSet.has(line.ledgerId)) return;
      const debit = Number(line.debit ?? 0);
      const credit = Number(line.credit ?? 0);
      if (debit === 0 && credit === 0) return;
      rows.push({
        id: `${voucher.id}:${lineIndex}`,
        ledgerId: line.ledgerId,
        voucherType: voucher.type,
        voucherId: voucher.id,
        date: voucher.date,
        debit,
        credit,
        runningBalance: 0,
        meta: {
          ...(voucher.narration ? { narration: voucher.narration } : {}),
          voucherNumber: voucher.number,
        },
        createdAt: voucher.createdAt,
      });
    });
  }

  return rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** Merge voucher-derived rows with stored ledger transactions (dedupe by voucher+amounts). */
function mergeLedgerTransactions(
  stored: LedgerTransaction[],
  fromVouchers: LedgerTransaction[]
): LedgerTransaction[] {
  const key = (t: LedgerTransaction) =>
    `${t.voucherId}|${t.date}|${t.debit}|${t.credit}|${t.voucherType}`;
  const map = new Map<string, LedgerTransaction>();
  for (const t of stored) map.set(key(t), t);
  for (const t of fromVouchers) {
    const k = key(t);
    const existing = map.get(k);
    if (!existing) {
      map.set(k, t);
      continue;
    }
    const voucherNumber = (t.meta as { voucherNumber?: string } | undefined)?.voucherNumber;
    if (voucherNumber) {
      map.set(k, {
        ...existing,
        meta: { ...(existing.meta ?? {}), voucherNumber },
      });
    }
  }
  return [...map.values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** Stored ledger rows often lack voucherNumber in meta — always overlay from live voucher.number. */
function enrichLedgerTransactionsWithVoucherNumbers(
  transactions: LedgerTransaction[],
  voucherById: Map<string, Voucher>
): LedgerTransaction[] {
  return transactions.map((txn) => {
    if (!txn.voucherId || txn.voucherId.startsWith('opening-')) return txn;
    const voucher = voucherById.get(txn.voucherId);
    const number = String(voucher?.number ?? '').trim();
    if (!number) return txn;
    return {
      ...txn,
      meta: {
        ...(txn.meta ?? {}),
        voucherNumber: number,
      },
    };
  });
}

export const ledgerReportService = {
  async getStatement(ledgerId: string, filters: LedgerStatementFilters = {}): Promise<LedgerStatement> {
    const ledger = await ledgerAccountService.getById(ledgerId);
    if (!ledger) {
      throw new Error('Ledger not found');
    }

    const fromTs = parseDateOrThrow(filters.fromDate);
    const toTs = parseDateOrThrow(filters.toDate);
    if (fromTs !== null && toTs !== null && fromTs > toTs) {
      throw new Error('From date cannot be after To date');
    }

    const relatedLedgerIds = await resolveRelatedLedgerIds(ledgerId);
    const vouchers = await voucherService.list();
    const voucherById = new Map(
      (await voucherService.list({ includeDeleted: true })).map((v) => [v.id, v])
    );
    const storedTxns = (
      await Promise.all(relatedLedgerIds.map((id) => ledgerTransactionService.list({ ledgerId: id })))
    ).flat();
    const voucherTxns = await buildTransactionsFromVouchers(relatedLedgerIds, vouchers);
    const transactions = enrichLedgerTransactionsWithVoucherNumbers(
      mergeLedgerTransactions(storedTxns, voucherTxns),
      voucherById
    );

    const openingBalance = computeLedgerOpening(ledger, transactions, fromTs);
    const statementEntries: LedgerStatementEntry[] = [];
    let running = openingBalance;

    for (const txn of transactions) {
      const txnTs = Date.parse(txn.date);
      if (Number.isNaN(txnTs)) {
        continue;
      }
      if (isBefore(txnTs, fromTs)) {
        continue;
      }
      if (isAfter(txnTs, toTs)) {
        continue;
      }
      running = Number((running + txn.debit - txn.credit).toFixed(4));
      statementEntries.push({
        ...txn,
        runningBalance: running,
      });
    }

    const closingBalance =
      statementEntries.length > 0
        ? statementEntries[statementEntries.length - 1].runningBalance
        : openingBalance;

    return {
      ledger,
      openingBalance,
      closingBalance,
      transactions: statementEntries,
    };
  },
};
