const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const renderTemplateString = (template: string, vars: Record<string, string>): string => {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value ?? '');
  }
  return out;
};

export const fmtMoney = (n: number): string => Number(n || 0).toFixed(2);

/** Indian numbering: 9,737.30 */
export const fmtMoneyIN = (n: number): string =>
  Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtDateIN = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-IN');
  } catch {
    return String(iso || '');
  }
};

/** Tally-style: 28-Dec-25 */
export const fmtDateDDMonYY = (iso: string): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const mon = d.toLocaleString('en-GB', { month: 'short' });
    const yy = String(d.getFullYear()).slice(-2);
    return `${day}-${mon}-${yy}`;
  } catch {
    return '';
  }
};

export const blank = (value: unknown): string => {
  const s = String(value ?? '').trim();
  return s;
};

export { escapeHtml };
