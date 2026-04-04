/**
 * Sales Voucher Posting with GST Bifurcation
 * Handles posting of sales vouchers with automatic GST splitting and ledger mapping
 */

import { VoucherLine } from '../../types/vouchers';
import {
  bifurcateTax,
  calculateRoundOff,
  calculateChargeGST,
  TaxType,
  AdditionalCharge,
} from './gstBifurcationEngine';
import { decideGSTType } from './gstDecisionEngine';
import { autoLedgerService } from '../masters/autoLedgerService';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { Party } from '../../types/party';

export interface SalesLineWithGST {
  itemId: string;
  quantity: number;
  amount: number; // Pre-tax
  gstPercent: number;
  godownId: string;
}

export interface SalesVoucherBuildingInput {
  customerLedgerId: string;
  salesLedgerId: string;
  lines: SalesLineWithGST[];
  additionalCharges?: AdditionalCharge[];
  companyState: string;
  partyState: string;
  narration?: string;
}

export interface PostingLineDetail {
  ledgerId: string;
  ledgerName: string;
  debit: number;
  credit: number;
  itemId?: string;
  quantity?: number;
  godownId?: string;
  taxType?: TaxType;
  chargeType?: string;
  description?: string;
}

/**
 * Build complete voucher lines for sales with GST bifurcation
 * Posting order:
 * 1. Debit customer account (full amount including tax)
 * 2. Credit sales ledgers (one per item)
 * 3. Credit CGST/SGST or IGST (split appropriately)
 * 4. Handle additional charges if any
 * 5. Handle round-off if needed
 */
export async function buildSalesVoucherLinesWithGST(
  input: SalesVoucherBuildingInput
): Promise<{
  lines: VoucherLine[];
  postingDetails: PostingLineDetail[];
  totals: { subtotal: number; tax: number; charges: number; roundOff: number; grandTotal: number };
}> {
  // Create a party object from the input for GST decision
  const partyFromInput: Party = {
    id: '', // Not needed for GST decision
    name: '',
    gstin: '', // Will be handled by the decision engine
    state: input.partyState,
    mobile: '',
    email: '',
    address: '',
    pincode: '',
    partyType: 'BUYER',
    ledgerId: '',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Use the new GST decision engine
  const gstDecision = decideGSTType(partyFromInput, input.companyState);
  const taxType = gstDecision.taxType;

  // Ensure GST output ledgers exist
  const { cgstOutputLedgerId, sgstOutputLedgerId, igstOutputLedgerId } = await autoLedgerService.ensureGSTOutputLedgers();

  // Calculate totals
  const subtotal = Number(
    input.lines.reduce((sum, line) => sum + line.amount, 0).toFixed(2)
  );

  // Calculate item tax
  let itemTaxAmount = 0;
  for (const line of input.lines) {
    const tax = (line.amount * line.gstPercent) / 100;
    itemTaxAmount += tax;
  }
  itemTaxAmount = Number(itemTaxAmount.toFixed(2));

  // Bifurcate item tax
  const avgGstPercent =
    input.lines.length > 0
      ? input.lines.reduce((sum, line) => sum + line.gstPercent, 0) / input.lines.length
      : 0;
  const itemTax = bifurcateTax(itemTaxAmount, avgGstPercent, taxType);

  // Process additional charges
  const processedCharges: AdditionalCharge[] = [];
  let chargeTaxAmount = 0;

  if (input.additionalCharges && input.additionalCharges.length > 0) {
    for (const charge of input.additionalCharges) {
      const chargeGst = calculateChargeGST(charge);
      const chargeLedgerId = charge.ledgerId || (await autoLedgerService.ensureExpenseLedger(charge.name));

      processedCharges.push({
        ...charge,
        gst: chargeGst,
        ledgerId: chargeLedgerId,
      });

      chargeTaxAmount += chargeGst;
    }
  }

  chargeTaxAmount = Number(chargeTaxAmount.toFixed(2));
  const chargeTax = processedCharges.length > 0 ? bifurcateTax(chargeTaxAmount, processedCharges[0].gstPercent || 0, taxType) : { type: taxType, cgst: 0, sgst: 0, igst: 0, total: 0 };

  // Calculate total before round-off
  const chargeAmount = processedCharges.reduce((sum, c) => sum + c.amount, 0);
  const totalBeforeRoundOff = subtotal + itemTax.total + chargeAmount + chargeTax.total;

  // Calculate round-off
  const roundOff = calculateRoundOff(totalBeforeRoundOff, 1);

  // Final grand total
  const grandTotal = Number((totalBeforeRoundOff + roundOff).toFixed(2));

  // Build voucher lines
  const lines: VoucherLine[] = [];
  const postingDetails: PostingLineDetail[] = [];

  // 1. Debit Customer
  lines.push({
    ledgerId: input.customerLedgerId,
    debit: grandTotal,
    credit: 0,
  });

  const customerLedger = await ledgerAccountService.getById(input.customerLedgerId);
  postingDetails.push({
    ledgerId: input.customerLedgerId,
    ledgerName: customerLedger?.name || 'Customer',
    debit: grandTotal,
    credit: 0,
  });

  // 2. Credit Sales Ledgers (one per line item)
  for (const line of input.lines) {
    lines.push({
      ledgerId: input.salesLedgerId,
      debit: 0,
      credit: line.amount,
      itemId: line.itemId,
      quantity: line.quantity,
      godownId: line.godownId,
    });
  }

  const salesLedger = await ledgerAccountService.getById(input.salesLedgerId);
  if (input.lines.length > 0) {
    postingDetails.push({
      ledgerId: input.salesLedgerId,
      ledgerName: salesLedger?.name || 'Sales',
      debit: 0,
      credit: subtotal,
      description: `Sales of ${input.lines.length} item${input.lines.length > 1 ? 's' : ''}`,
    });
  }

  // 3. Credit GST (bifurcated)
  if (itemTax.total > 0) {
    if (taxType === 'CGST_SGST') {
      // CGST
      if (itemTax.cgst > 0) {
        lines.push({
          ledgerId: cgstOutputLedgerId,
          debit: 0,
          credit: itemTax.cgst,
          taxType: 'CGST_SGST',
          cgstAmount: itemTax.cgst,
          cgstLedgerId: cgstOutputLedgerId,
        });

        const cgstLedger = await ledgerAccountService.getById(cgstOutputLedgerId);
        postingDetails.push({
          ledgerId: cgstOutputLedgerId,
          ledgerName: cgstLedger?.name || 'CGST Output',
          debit: 0,
          credit: itemTax.cgst,
          taxType: 'CGST_SGST',
          description: `CGST on sales (${avgGstPercent}%)`,
        });
      }

      // SGST
      if (itemTax.sgst > 0) {
        lines.push({
          ledgerId: sgstOutputLedgerId,
          debit: 0,
          credit: itemTax.sgst,
          taxType: 'CGST_SGST',
          sgstAmount: itemTax.sgst,
          sgstLedgerId: sgstOutputLedgerId,
        });

        const sgstLedger = await ledgerAccountService.getById(sgstOutputLedgerId);
        postingDetails.push({
          ledgerId: sgstOutputLedgerId,
          ledgerName: sgstLedger?.name || 'SGST Output',
          debit: 0,
          credit: itemTax.sgst,
          taxType: 'CGST_SGST',
          description: `SGST on sales (${avgGstPercent}%)`,
        });
      }
    } else {
      // IGST
      if (itemTax.igst > 0) {
        lines.push({
          ledgerId: igstOutputLedgerId,
          debit: 0,
          credit: itemTax.igst,
          taxType: 'IGST',
          igstAmount: itemTax.igst,
          igstLedgerId: igstOutputLedgerId,
        });

        const igstLedger = await ledgerAccountService.getById(igstOutputLedgerId);
        postingDetails.push({
          ledgerId: igstOutputLedgerId,
          ledgerName: igstLedger?.name || 'IGST Output',
          debit: 0,
          credit: itemTax.igst,
          taxType: 'IGST',
          description: `IGST on sales (${avgGstPercent}%)`,
        });
      }
    }
  }

  // 4. Additional Charges
  for (const charge of processedCharges) {
    if (charge.amount > 0 && charge.ledgerId) {
      lines.push({
        ledgerId: charge.ledgerId,
        debit: 0,
        credit: charge.amount,
        chargeType: charge.name,
      });

      const chargeLedger = await ledgerAccountService.getById(charge.ledgerId);
      postingDetails.push({
        ledgerId: charge.ledgerId,
        ledgerName: chargeLedger?.name || charge.name,
        debit: 0,
        credit: charge.amount,
        chargeType: charge.name,
      });

      // If charge is taxable, add GST
      if (charge.isTaxable && charge.gst && charge.gst > 0) {
        if (taxType === 'CGST_SGST') {
          // CGST on charge
          const cgstOnCharge = charge.gst / 2;
          if (cgstOnCharge > 0) {
            lines.push({
              ledgerId: cgstOutputLedgerId,
              debit: 0,
              credit: cgstOnCharge,
              taxType: 'CGST_SGST',
              cgstAmount: cgstOnCharge,
              cgstLedgerId: cgstOutputLedgerId,
            });
          }

          // SGST on charge
          const sgstOnCharge = charge.gst / 2;
          if (sgstOnCharge > 0) {
            lines.push({
              ledgerId: sgstOutputLedgerId,
              debit: 0,
              credit: sgstOnCharge,
              taxType: 'CGST_SGST',
              sgstAmount: sgstOnCharge,
              sgstLedgerId: sgstOutputLedgerId,
            });
          }
        } else {
          // IGST on charge
          if (charge.gst > 0) {
            lines.push({
              ledgerId: igstOutputLedgerId,
              debit: 0,
              credit: charge.gst,
              taxType: 'IGST',
              igstAmount: charge.gst,
              igstLedgerId: igstOutputLedgerId,
            });
          }
        }
      }
    }
  }

  // 5. Round-Off
  if (roundOff !== 0) {
    // Determine round-off ledger
    const roundOffLedgerId = await autoLedgerService.ensureExpenseLedger('Round Off');
    if (roundOff > 0) {
      // Debit round-off (customer paid less)
      lines.push({
        ledgerId: roundOffLedgerId,
        debit: roundOff,
        credit: 0,
        roundOffAmount: roundOff,
      });
    } else {
      // Credit round-off (customer paid more)
      lines.push({
        ledgerId: roundOffLedgerId,
        debit: 0,
        credit: Math.abs(roundOff),
        roundOffAmount: roundOff,
      });
    }

    const roundOffLedger = await ledgerAccountService.getById(roundOffLedgerId);
    postingDetails.push({
      ledgerId: roundOffLedgerId,
      ledgerName: roundOffLedger?.name || 'Round Off',
      debit: roundOff > 0 ? roundOff : 0,
      credit: roundOff > 0 ? 0 : Math.abs(roundOff),
      description: `Round-off adjustment (₹${roundOff.toFixed(2)})`,
    });
  }

  return {
    lines,
    postingDetails,
    totals: {
      subtotal,
      tax: itemTax.total,
      charges: chargeAmount,
      roundOff,
      grandTotal,
    },
  };
}

/**
 * Check if posting balances (debit == credit)
 */
export function validatePostingBalance(lines: VoucherLine[]): boolean {
  const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  return totalDebit > 0 && Number(totalDebit.toFixed(2)) === Number(totalCredit.toFixed(2));
}
