import type { StockAdjustmentDirection, StockAdjustmentReasonType } from '../types/masters';

export const STOCK_ADJUSTMENT_REASON_OPTIONS: {
  value: StockAdjustmentReasonType;
  label: string;
  autoDirection?: StockAdjustmentDirection;
}[] = [
  { value: 'EXCESS_FOUND', label: 'Excess Found (Stock Take)', autoDirection: 'INCREASE' },
  { value: 'THEFT', label: 'Theft / Stolen', autoDirection: 'DECREASE' },
  { value: 'DAMAGED', label: 'Damaged / Spoiled', autoDirection: 'DECREASE' },
  { value: 'LOST', label: 'Lost / Missing', autoDirection: 'DECREASE' },
  { value: 'SAMPLE_INTERNAL', label: 'Sample / Internal Use', autoDirection: 'DECREASE' },
  { value: 'OTHER', label: 'Other (specify)' },
];

export function directionForReasonType(
  reasonType: StockAdjustmentReasonType | ''
): StockAdjustmentDirection | null {
  if (!reasonType) return null;
  const row = STOCK_ADJUSTMENT_REASON_OPTIONS.find((o) => o.value === reasonType);
  return row?.autoDirection ?? null;
}

export function reasonTypeLabel(reasonType: StockAdjustmentReasonType | null | undefined): string {
  if (!reasonType) return '—';
  return STOCK_ADJUSTMENT_REASON_OPTIONS.find((o) => o.value === reasonType)?.label ?? reasonType;
}
