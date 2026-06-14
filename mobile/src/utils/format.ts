export function formatInr(value: number | string | undefined): string {
  const n = Number(value || 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateDdMmYyyy(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const parts = String(iso).slice(0, 10).split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return String(iso);
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function formatTimeHm(date = new Date()): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function greetingForHour(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function financialYearLabel(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (m >= 4) return `FY ${y}-${String(y + 1).slice(-2)}`;
  return `FY ${y - 1}-${String(y).slice(-2)}`;
}

export function formatPct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}% vs prior`;
}

export function normalizeStatus(status?: string): 'paid' | 'overdue' | 'partial' | 'draft' | 'open' {
  const s = String(status || 'open').toLowerCase();
  if (s.includes('paid') || s === 'clear') return 'paid';
  if (s.includes('overdue')) return 'overdue';
  if (s.includes('partial')) return 'partial';
  if (s.includes('draft')) return 'draft';
  return 'open';
}
