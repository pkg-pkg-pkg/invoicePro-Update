import type { InventoryItem, StockAdjustmentReasonType } from '../../types/masters';
import type { VoucherLine } from '../../types/vouchers';
import { reasonTypeLabel } from '../../constants/stockAdjustmentReasons';
import { voucherService } from '../vouchers/voucherService';
import {
  ensureStockAdjustmentLedgers,
  STOCK_ADJ_LEDGER_IDS,
} from './stockAdjustmentLedgerService';

type PostingInput = {
  item: InventoryItem;
  direction: 'INCREASE' | 'DECREASE';
  reasonType: StockAdjustmentReasonType;
  value: number;
  date: string;
  notes?: string | null;
  quantity: number;
};

function expenseLedgerForReason(reasonType: StockAdjustmentReasonType): string {
  switch (reasonType) {
    case 'THEFT':
      return STOCK_ADJ_LEDGER_IDS.lossTheft;
    case 'DAMAGED':
      return STOCK_ADJ_LEDGER_IDS.stockDamage;
    case 'LOST':
      return STOCK_ADJ_LEDGER_IDS.stockShortage;
    case 'SAMPLE_INTERNAL':
      return STOCK_ADJ_LEDGER_IDS.samplesInternal;
    case 'OTHER':
      return STOCK_ADJ_LEDGER_IDS.adjustmentExpense;
    default:
      return STOCK_ADJ_LEDGER_IDS.adjustmentExpense;
  }
}

function buildLines(input: PostingInput): VoucherLine[] {
  const amount = Number(input.value.toFixed(2));
  const stockId = STOCK_ADJ_LEDGER_IDS.stockAsset;

  if (input.direction === 'INCREASE') {
    return [
      { ledgerId: stockId, debit: amount, credit: 0 },
      { ledgerId: STOCK_ADJ_LEDGER_IDS.adjustmentGain, debit: 0, credit: amount },
    ];
  }

  const expenseId = expenseLedgerForReason(input.reasonType);
  return [
    { ledgerId: expenseId, debit: amount, credit: 0 },
    { ledgerId: stockId, debit: 0, credit: amount },
  ];
}

/** Post balanced journal entry for a stock adjustment (Excl. GST stock asset value only). */
export async function postStockAdjustmentJournal(input: PostingInput): Promise<string | null> {
  if (input.value <= 0) return null;

  await ensureStockAdjustmentLedgers();

  const reasonLabel = reasonTypeLabel(input.reasonType);
  const narrationParts = [
    `Stock adjustment: ${input.item.name}`,
    `Qty ${input.quantity}`,
    reasonLabel,
    input.notes?.trim() ? input.notes.trim() : null,
  ].filter(Boolean);

  const voucher = await voucherService.create({
    type: 'JOURNAL',
    date: input.date,
    number: '',
    narration: narrationParts.join(' · '),
    lines: buildLines(input),
  });

  return voucher.id;
}
