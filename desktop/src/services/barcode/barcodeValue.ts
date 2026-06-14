export type BarcodeFormat = 'CODE128' | 'EAN13' | 'QR';

/** EAN-13 check digit for 12-digit body. */
export function ean13CheckDigit(body12: string): string {
  const digits = body12.replace(/\D/g, '').padStart(12, '0').slice(-12).split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

/** 7-digit prefix + 5-digit sequence → 12-digit EAN body (no check digit). */
export function composeEan13Body(prefix: string, sequence: number): string {
  const p = prefix.replace(/\D/g, '').slice(0, 7).padEnd(7, '0');
  const seqStr = String(Math.max(1, sequence)).padStart(5, '0').slice(-5);
  return `${p}${seqStr}`.slice(0, 12).padEnd(12, '0');
}

export function formatEan13(prefix: string, sequence: number): string {
  const body = composeEan13Body(prefix, sequence);
  return `${body}${ean13CheckDigit(body)}`;
}

/** Sync fallback only — prefer generateUniqueNumericBarcode() for uniqueness. */
export function generateUniqueBarcode(): string {
  const seq = (Date.now() % 99999) + 1;
  return formatEan13('8901000', seq);
}

/** @deprecated Use generateUniqueNumericBarcode — does not use SKU. */
export function generateBarcodeValue(_sku?: string | null): string {
  return generateUniqueBarcode();
}

export function normalizeBarcode(raw: string): string {
  return String(raw ?? '').trim();
}

export function isNumericBarcode(value: string): boolean {
  return /^\d{12,13}$/.test(normalizeBarcode(value));
}

export function pickBarcodeFormat(value: string): BarcodeFormat {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 13 || digits.length === 12) return 'EAN13';
  if (value.length > 24) return 'QR';
  return 'CODE128';
}
