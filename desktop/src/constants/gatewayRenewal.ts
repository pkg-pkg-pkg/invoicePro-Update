/** Annual Gateway renewal: ₹699 + 18% GST (updates + new features; license itself stays valid). */
export const GATEWAY_UPI_PAYEE = '7549030630@okbizaxis';

/** Total INR payable (699 × 1.18 ≈ 824.82, rounded for UPI). */
export const GATEWAY_RENEWAL_AMOUNT_INR = 825;

export const GATEWAY_PRICING_LABEL = '₹699 + 18% GST ≈ ₹825/year';

export function buildGatewayUpiPayUrl(): string {
  const params = new URLSearchParams({
    pa: GATEWAY_UPI_PAYEE,
    pn: 'PVEB',
    am: GATEWAY_RENEWAL_AMOUNT_INR.toFixed(2),
    cu: 'INR',
    tn: 'PVE InvoicePro 360 Gateway renewal',
  });
  return `upi://pay?${params.toString()}`;
}

export function gatewayUpiQrImageUrl(size = 200): string {
  const data = encodeURIComponent(buildGatewayUpiPayUrl());
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`;
}
