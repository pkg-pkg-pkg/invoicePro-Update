import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import type { BarcodeFormat } from './barcodeValue';
import { pickBarcodeFormat } from './barcodeValue';

export async function renderBarcodeDataUrl(
  value: string,
  format?: BarcodeFormat
): Promise<string> {
  const code = String(value ?? '').trim();
  if (!code) return '';

  const fmt = format ?? pickBarcodeFormat(code);

  if (fmt === 'QR') {
    return QRCode.toDataURL(code, { margin: 1, width: 200, errorCorrectionLevel: 'M' });
  }

  const canvas = document.createElement('canvas');
  if (fmt === 'EAN13') {
    const digits = code.replace(/\D/g, '');
    const ean = digits.length >= 13 ? digits.slice(0, 13) : digits.padStart(13, '0');
    JsBarcode(canvas, ean, { format: 'EAN13', displayValue: true, margin: 8, height: 60 });
  } else {
    JsBarcode(canvas, code, { format: 'CODE128', displayValue: true, margin: 8, height: 60 });
  }
  return canvas.toDataURL('image/png');
}
