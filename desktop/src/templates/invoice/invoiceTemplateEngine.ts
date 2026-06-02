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

export const fmtDateIN = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-IN');
  } catch {
    return String(iso || '');
  }
};

export { escapeHtml };
