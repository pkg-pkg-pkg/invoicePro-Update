/**
 * GST Bifurcation & Tax Calculation Engine
 * Handles:
 * - Auto-detection of CGST+SGST vs IGST based on state using proper priority logic
 * - Round-off calculation
 * - Additional charges with their own GST
 * - Complete tax ledger mapping
 */

import { ledgerAccountService } from '../masters/ledgerAccountService';
import { autoLedgerService } from '../masters/autoLedgerService';
import { GSTDecisionResult, TaxType } from './gstDecisionEngine';

// Re-export types for backward compatibility
export type SupplyType = 'INTRA_STATE' | 'INTER_STATE';
export type { TaxType };

export interface TaxBreakup {
  type: TaxType;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface AdditionalCharge {
  id: string;
  name: string;
  amount: number;
  isTaxable: boolean;
  gstPercent: number; // 0-28
  gst?: number; // Calculated if taxable
  ledgerId?: string; // Auto-resolved ledger for posting
}

export interface TaxCalculationInput {
  lineItems: Array<{
    amount: number; // Pre-tax amount
    gstPercent: number;
  }>;
  additionalCharges?: AdditionalCharge[];
  roundOffToNearest?: number; // Default: 1 (₹1)
}

export interface TaxCalculationResult {
  subtotal: number;
  itemTax: TaxBreakup;
  additionalCharges: AdditionalCharge[];
  chargeTax: TaxBreakup;
  roundOff: number;
  grandTotal: number;
  // Ledger posting details
  ledgerEntries: Array<{
    ledgerId: string;
    ledgerName: string;
    debit: number;
    credit: number;
  }>;
}

/**
 * Determine GST tax type based on decision result
 */
export function determineTaxType(decisionResult: GSTDecisionResult): TaxType {
  return decisionResult.taxType;
}

/**
 * Bifurcate tax based on supply type
 */
export function bifurcateTax(totalTax: number, _gstPercent: number, taxType: TaxType): TaxBreakup {
  if (taxType === 'CGST_SGST') {
    // Split equally: each is 50% of total GST %
    return {
      type: 'CGST_SGST',
      cgst: totalTax / 2,
      sgst: totalTax / 2,
      igst: 0,
      total: totalTax,
    };
  } else {
    // IGST takes full amount
    return {
      type: 'IGST',
      cgst: 0,
      sgst: 0,
      igst: totalTax,
      total: totalTax,
    };
  }
}

/**
 * Calculate round-off to nearest specified amount
 */
export function calculateRoundOff(amount: number, roundToNearest: number = 1): number {
  if (roundToNearest <= 0) return 0;
  const rounded = Math.round(amount / roundToNearest) * roundToNearest;
  return Number((rounded - amount).toFixed(2));
}

/**
 * Calculate GST for additional charges
 */
export function calculateChargeGST(charge: AdditionalCharge): number {
  if (!charge.isTaxable) return 0;
  const gst = (charge.amount * charge.gstPercent) / 100;
  return Number(gst.toFixed(2));
}

/**
 * Resolve ledger account for additional charge
 */
export async function resolveChargeLedger(chargeName: string): Promise<string | undefined> {
  try {
    // Try to find existing ledger for this charge
    const ledgers = await ledgerAccountService.list({ includeInactive: false });
    const match = ledgers.find(l =>
      l.name.toLowerCase().includes(chargeName.toLowerCase()) &&
      l.isActive
    );
    
    if (match) return match.id;

    // Auto-create if not found (similar to common accounting behavior)
    // Use the auto-ledger service to create under appropriate group
    const createdLedgerId = await autoLedgerService.ensureExpenseLedger(chargeName);
    return createdLedgerId;
  } catch (error) {
    console.warn(`Failed to resolve ledger for charge "${chargeName}":`, error);
    return undefined;
  }
}

/**
 * Complete tax calculation with bifurcation, round-off, and charges
 */
export async function calculateTaxComplete(
  input: TaxCalculationInput,
  taxType: TaxType
): Promise<TaxCalculationResult> {
  // Calculate subtotal from line items
  const subtotal = Number(
    input.lineItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)
  );

  // Calculate item-level GST
  let itemTaxAmount = 0;
  for (const item of input.lineItems) {
    const tax = (item.amount * item.gstPercent) / 100;
    itemTaxAmount += tax;
  }
  itemTaxAmount = Number(itemTaxAmount.toFixed(2));

  // Bifurcate item tax (use first item's GST % as reference, or average)
  const avgGstPercent = input.lineItems.length > 0
    ? input.lineItems.reduce((sum, item) => sum + item.gstPercent, 0) / input.lineItems.length
    : 0;
  const itemTax = bifurcateTax(itemTaxAmount, avgGstPercent, taxType);

  // Process additional charges
  const charges: AdditionalCharge[] = [];
  let chargeTaxAmount = 0;

  if (input.additionalCharges && input.additionalCharges.length > 0) {
    for (const charge of input.additionalCharges) {
      const chargeGst = calculateChargeGST(charge);
      const chargeWithGst: AdditionalCharge = {
        ...charge,
        gst: chargeGst,
        ledgerId: await resolveChargeLedger(charge.name),
      };
      charges.push(chargeWithGst);
      chargeTaxAmount += chargeGst;
    }
  }

  chargeTaxAmount = Number(chargeTaxAmount.toFixed(2));
  const chargeTax = charges.length > 0
    ? bifurcateTax(chargeTaxAmount, charges[0].gstPercent || 0, taxType)
    : { type: taxType, cgst: 0, sgst: 0, igst: 0, total: 0 };

  // Total before round-off
  const chargeAmount = charges.reduce((sum, c) => sum + c.amount, 0);
  const totalBeforeRoundOff =
    subtotal + itemTax.total + chargeAmount + chargeTax.total;

  // Calculate round-off
  const roundOff = calculateRoundOff(totalBeforeRoundOff, input.roundOffToNearest);

  // Final grand total
  const grandTotal = Number((totalBeforeRoundOff + roundOff).toFixed(2));

  // Build ledger entries for posting
  const ledgerEntries: Array<{ ledgerId: string; ledgerName: string; debit: number; credit: number }> = [];

  // For now, we'll return empty ledger entries - they'll be populated when posting the voucher
  // The actual ledger selection happens during voucher posting

  return {
    subtotal,
    itemTax,
    additionalCharges: charges,
    chargeTax,
    roundOff,
    grandTotal,
    ledgerEntries,
  };
}

/**
 * Format tax breakup for display
 */
export function formatTaxBreakup(tax: TaxBreakup): string {
  if (tax.type === 'CGST_SGST') {
    return `CGST: ₹${tax.cgst.toFixed(2)} + SGST: ₹${tax.sgst.toFixed(2)}`;
  } else {
    return `IGST: ₹${tax.igst.toFixed(2)}`;
  }
}
