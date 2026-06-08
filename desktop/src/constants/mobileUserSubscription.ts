/** Mobile ERP user seat — annual access while desktop is online (no cloud DB). */
export const MOBILE_USER_UPI_PAYEE = '7549030630@okbizaxis';

/** ₹599/year per mobile user (all-inclusive for listing). */
export const MOBILE_USER_ANNUAL_INR = 599;

export const MOBILE_USER_PRICING_LABEL = '₹599/year per mobile user';

export function buildMobileUserUpiPayUrl(userLabel?: string): string {
  const params = new URLSearchParams({
    pa: MOBILE_USER_UPI_PAYEE,
    pn: 'PVEB',
    am: MOBILE_USER_ANNUAL_INR.toFixed(2),
    cu: 'INR',
    tn: userLabel
      ? `PVE Mobile User — ${userLabel}`.slice(0, 80)
      : 'PVE InvoicePro 360 Mobile User',
  });
  return `upi://pay?${params.toString()}`;
}

export function mobileUserUpiQrImageUrl(size = 200, userLabel?: string): string {
  const data = encodeURIComponent(buildMobileUserUpiPayUrl(userLabel));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`;
}
