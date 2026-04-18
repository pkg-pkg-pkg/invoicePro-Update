import { ledgerTransactionService } from './ledgerTransactionService';
import type { VoucherLine, VoucherType } from '../../types/vouchers';

/** Sales / purchase documents (and returns) — billing; other voucher types do not block delete. */
const INVOICE_BILLING_TYPES = new Set<VoucherType>(['SALES', 'PURCHASE', 'SALES_RETURN', 'PURCHASE_RETURN']);

function lineReferencesLedger(line: VoucherLine, ledgerId: string): boolean {
  if (line.ledgerId === ledgerId) return true;
  if (line.cgstLedgerId === ledgerId || line.sgstLedgerId === ledgerId || line.igstLedgerId === ledgerId) return true;
  return false;
}

function isBillingVoucherType(type: string | undefined): boolean {
  return type != null && INVOICE_BILLING_TYPES.has(type as VoucherType);
}

/** Block ledger deactivation only for invoice/billing usage or party link — not journal/payment-only, etc. */
export async function assertLedgerCanBeDeactivated(ledgerId: string): Promise<void> {
  const txns = await ledgerTransactionService.findByLedger(ledgerId);
  const billingTxns = txns.filter((t) => isBillingVoucherType(t.voucherType));
  if (billingTxns.length > 0) {
    throw new Error(
      'This ledger cannot be deactivated because it is used on a sales or purchase invoice (or return). Remove or change those bills first.'
    );
  }

  const { voucherService } = await import('../vouchers/voucherService');
  const vouchers = await voucherService.list();
  const billingHit = vouchers.find(
    (v) =>
      isBillingVoucherType(v.type) &&
      Array.isArray(v.lines) &&
      v.lines.some((line) => lineReferencesLedger(line, ledgerId))
  );
  if (billingHit) {
    throw new Error(
      `This ledger cannot be deactivated because it appears on invoice ${billingHit.number} (${billingHit.type}). Remove or edit that bill first.`
    );
  }

  const { partyService } = await import('./partyService');
  const parties = await partyService.list();
  if (parties.some((p) => p.ledgerId === ledgerId)) {
    throw new Error(
      'This ledger cannot be deactivated because it is linked to a party in Party Master. Change or remove that party first.'
    );
  }
}

/** Block item deactivation only when it appears on a sales/purchase invoice (or return) — not other voucher types or stock adjustments alone. */
export async function assertInventoryItemCanBeDeactivated(itemId: string): Promise<void> {
  const { voucherService } = await import('../vouchers/voucherService');
  const vouchers = await voucherService.list();
  const voucherHit = vouchers.find(
    (v) =>
      isBillingVoucherType(v.type) &&
      Array.isArray(v.lines) &&
      v.lines.some((line) => line.itemId === itemId)
  );
  if (voucherHit) {
    throw new Error(
      `This item cannot be deactivated because it appears on invoice ${voucherHit.number} (${voucherHit.type}). Remove or change that bill first.`
    );
  }
}
