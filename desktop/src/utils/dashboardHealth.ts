export type HealthLevel = 'ok' | 'warn' | 'error';

export interface HealthStatusRow {
  label: string;
  status: string;
  level: HealthLevel;
}

export function computeBusinessHealthScore(input: {
  totalOutstanding: number;
  totalSales: number;
  gstConfigured: boolean;
  lowStockCount: number;
  grossProfit: number;
}): { score: number; rows: HealthStatusRow[] } {
  let score = 100;
  const rows: HealthStatusRow[] = [];

  const outstandingRatio =
    input.totalSales > 0 ? input.totalOutstanding / input.totalSales : input.totalOutstanding > 0 ? 1 : 0;

  if (outstandingRatio > 1.2) {
    score -= 18;
    rows.push({ label: 'Collections', status: 'Needs attention', level: 'warn' });
  } else if (outstandingRatio > 0.5) {
    score -= 6;
    rows.push({ label: 'Collections', status: 'Fair', level: 'warn' });
  } else {
    rows.push({ label: 'Collections', status: 'Good', level: 'ok' });
  }

  if (input.gstConfigured) {
    rows.push({ label: 'GST Compliance', status: 'Excellent', level: 'ok' });
  } else {
    score -= 12;
    rows.push({ label: 'GST Compliance', status: 'Not configured', level: 'warn' });
  }

  if (input.lowStockCount > 0) {
    score -= 10;
    rows.push({ label: 'Inventory', status: 'Warning', level: 'warn' });
  } else {
    rows.push({ label: 'Inventory', status: 'Good', level: 'ok' });
  }

  if (input.grossProfit > 0) {
    rows.push({ label: 'Profitability', status: 'Good', level: 'ok' });
  } else if (input.grossProfit === 0) {
    score -= 4;
    rows.push({ label: 'Profitability', status: 'Neutral', level: 'warn' });
  } else {
    score -= 14;
    rows.push({ label: 'Profitability', status: 'Review', level: 'error' });
  }

  return { score: Math.max(52, Math.min(100, score)), rows };
}
