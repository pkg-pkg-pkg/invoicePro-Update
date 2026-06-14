import { normalizeBarcode } from './barcodeValue';

const GST_MIN = 0;
const GST_MAX = 100;
const BARCODE_MIN_LEN = 3;
const BARCODE_MAX_LEN = 64;

/** Accepts numeric EAN/UPC and alphanumeric manufacturer codes (3–64 chars, no spaces). */
export function isValidBarcodeFormat(raw: string): boolean {
  const v = normalizeBarcode(raw);
  if (!v) return false;
  if (v.length < BARCODE_MIN_LEN || v.length > BARCODE_MAX_LEN) return false;
  if (/\s/.test(v)) return false;
  return /^[A-Za-z0-9\-_.]+$/.test(v);
}

export function isValidGstRate(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return false;
  return n >= GST_MIN && n <= GST_MAX;
}

export function parseAdditionalBarcodes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((v) => normalizeBarcode(String(v ?? '')))
      .filter(Boolean);
  }
  const text = String(raw ?? '').trim();
  if (!text) return [];
  return text
    .split(/[;\n,|]+/)
    .map((s) => normalizeBarcode(s))
    .filter(Boolean);
}

export function formatAdditionalBarcodesForExport(codes: string[] | null | undefined): string {
  if (!codes?.length) return '';
  return codes.join('; ');
}

export function validateBarcodeList(codes: string[]): string | null {
  for (const code of codes) {
    if (!isValidBarcodeFormat(code)) {
      return `Invalid barcode format: "${code}"`;
    }
  }
  const keys = codes.map((c) => normalizeBarcode(c).toLowerCase());
  if (new Set(keys).size !== keys.length) {
    return 'Duplicate barcodes on the same item';
  }
  return null;
}
