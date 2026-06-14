import QRCode from 'qrcode';
import { getActiveCompanyProfileRow } from './companyProfileDbService';

export const buildUpiPayUri = (params: {
  upiId: string;
  payeeName: string;
  amount: number;
  invoiceNumber: string;
}): string => {
  const pa = String(params.upiId || '').trim();
  if (!pa) return '';
  const pn = encodeURIComponent(String(params.payeeName || 'Merchant').slice(0, 80));
  const am = Number(params.amount || 0).toFixed(2);
  const tn = encodeURIComponent(String(params.invoiceNumber || 'Payment').slice(0, 40));
  return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
};

export async function generateUpiQrDataUrl(
  upiUri: string,
  sizePx = 160
): Promise<string> {
  if (!upiUri) return '';
  return QRCode.toDataURL(upiUri, {
    width: sizePx,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

export async function buildUpiQrHtmlBlock(options: {
  upiId?: string;
  payeeName?: string;
  companyName: string;
  amount: number;
  invoiceNumber: string;
  documentLabel?: string;
}): Promise<string> {
  const upiId = String(options.upiId || '').trim();
  if (!upiId) return '';
  const payeeName = String(options.payeeName || options.companyName || 'Merchant').trim();
  const docLabel = String(options.documentLabel || 'Invoice').trim();
  const uri = buildUpiPayUri({
    upiId,
    payeeName,
    amount: options.amount,
    invoiceNumber: `${docLabel} ${options.invoiceNumber}`.trim(),
  });
  if (!uri) return '';
  try {
    const dataUrl = await generateUpiQrDataUrl(uri, 160);
    return `<div class="upi-qr-block" style="text-align:center;margin-top:8px;">
      <a href="${uri}" title="Pay via UPI" style="text-decoration:none;color:inherit;">
        <img src="${dataUrl}" alt="UPI QR" style="width:80px;height:80px;object-fit:contain;cursor:pointer;" />
      </a>
      <div style="font-size:10px;color:#4b5563;margin-top:4px;">Scan to Pay via UPI</div>
      <div style="font-size:10px;color:#6b7280;">${upiId}</div>
    </div>`;
  } catch (e) {
    console.error('[upiQr] generate failed', e);
    return '';
  }
}

export async function readCompanyUpiProfile(): Promise<{ upiId: string; payeeName: string }> {
  try {
    const row = await getActiveCompanyProfileRow();
    return {
      upiId: String(row?.upi_id || '').trim(),
      payeeName: String(row?.upi_payee_name || row?.company_name || '').trim(),
    };
  } catch {
    return { upiId: '', payeeName: '' };
  }
}

export const readCompanyUpiId = (): string => {
  return '';
};
