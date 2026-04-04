/** UPI collect for multi-user LAN license (₹9,999 + 18% GST). */
export const MULTI_USER_UPI_PAYEE = '75490330630@okbizaxis';

/** Total payable in INR (inclusive of GST). */
export const MULTI_USER_AMOUNT_INR = 11800;

export const MULTI_USER_PRICING_LABEL = '₹9,999 + 18% GST = ₹11,800.00';

export function buildMultiUserUpiPayUrl(): string {
  const params = new URLSearchParams({
    pa: MULTI_USER_UPI_PAYEE,
    pn: 'PVEB',
    am: MULTI_USER_AMOUNT_INR.toFixed(2),
    cu: 'INR',
    tn: 'Multi-user LAN license',
  });
  return `upi://pay?${params.toString()}`;
}

/** Public QR image URL (no extra npm dependency). */
export function multiUserUpiQrImageUrl(size = 200): string {
  const data = encodeURIComponent(buildMultiUserUpiPayUrl());
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`;
}
