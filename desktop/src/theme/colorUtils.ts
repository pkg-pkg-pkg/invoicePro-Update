/**
 * WCAG-style contrast helpers so accent / surface colours get readable text automatically.
 */

const WHITE = '#ffffff';
const NEAR_BLACK = '#121212';

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = String(hex).replace(/^#/, '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex.startsWith('#') ? hex : `#${hex}`);
  if (!rgb) return 0;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = lin(rgb.r);
  const g = lin(rgb.g);
  const b = lin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1–21). */
export function contrastRatioHex(fgHex: string, bgHex: string): number {
  const fg = fgHex.startsWith('#') ? fgHex : `#${fgHex}`;
  const bg = bgHex.startsWith('#') ? bgHex : `#${bgHex}`;
  const L1 = getLuminance(fg) + 0.05;
  const L2 = getLuminance(bg) + 0.05;
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return hi / lo;
}

/** Solid text colour (white or near-black) on a solid background. */
export function contrastTextOnBackground(backgroundHex: string): string {
  const bg = backgroundHex.startsWith('#') ? backgroundHex : `#${backgroundHex}`;
  const w = contrastRatioHex(WHITE, bg);
  const b = contrastRatioHex(NEAR_BLACK, bg);
  return w >= b ? WHITE : NEAR_BLACK;
}

/** Linear blend: `amount` toward `blend` (0 = base only, 1 = blend only). */
export function mixHex(base: string, blend: string, amount: number): string {
  const a = hexToRgb(base.startsWith('#') ? base : `#${base}`);
  const b = hexToRgb(blend.startsWith('#') ? blend : `#${blend}`);
  if (!a || !b) return base.startsWith('#') ? base : `#${base}`;
  const t = Math.min(1, Math.max(0, amount));
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  const r = m(a.r, b.r);
  const g = m(a.g, b.g);
  const bl = m(a.b, b.b);
  return `#${[r, g, bl].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
