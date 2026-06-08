import QRCode from 'qrcode';

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
  const tn = encodeURIComponent(`Invoice ${String(params.invoiceNumber || '').slice(0, 40)}`);
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
  companyName: string;
  amount: number;
  invoiceNumber: string;
}): Promise<string> {
  const upiId = String(options.upiId || '').trim();
  if (!upiId) return '';
  const uri = buildUpiPayUri({
    upiId,
    payeeName: options.companyName,
    amount: options.amount,
    invoiceNumber: options.invoiceNumber,
  });
  if (!uri) return '';
  try {
    const dataUrl = await generateUpiQrDataUrl(uri, 160);
    return `<div class="upi-qr-block" style="text-align:center;margin-top:8px;">
      <img src="${dataUrl}" alt="UPI QR" style="width:80px;height:80px;object-fit:contain;" />
      <div style="font-size:10px;color:#4b5563;margin-top:4px;">Scan to Pay via UPI</div>
      <div style="font-size:10px;color:#6b7280;">${upiId}</div>
    </div>`;
  } catch (e) {
    console.error('[upiQr] generate failed', e);
    return '';
  }
}

export const readCompanyUpiId = (): string => {
  // UPI is optional; core profile is SQLite-backed (no localStorage profile reads).
  return '';
};
