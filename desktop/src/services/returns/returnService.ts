/**
 * Return Voucher Service
 * Handles fetching original invoice/voucher data for returns
 */

import { Voucher, VoucherLine } from '../vouchers/voucherService';
import { VoucherTotals } from '../../types/VoucherTotals';

export interface OriginalInvoiceData {
  id: string;
  type: 'SALES' | 'PURCHASE';
  number: string;
  date: string;
  partyName: string;
  partyLedgerId: string;
  totalAmount: number;
  items: InvoiceItem[];
  originalLines: VoucherLine[];
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate: number;
  godownId?: string;
  returnedQuantity?: number;
  maxReturnableQuantity: number;
}

/**
 * Fetch original invoice data by invoice number
 */
export async function fetchOriginalInvoice(invoiceNumber: string): Promise<OriginalInvoiceData | null> {
  try {
    // Try to fetch from backend API first
    const response = await fetch(`/api/invoices/number/${invoiceNumber}`);
    if (response.ok) {
      const invoice = await response.json();
      return transformInvoiceToReturnFormat(invoice);
    }
  } catch (error) {
    console.warn('Failed to fetch from API, trying local storage:', error);
  }

  // Fallback to local storage
  try {
    const vouchers = JSON.parse(localStorage.getItem('pve_vouchers') || '[]');
    const voucher = vouchers.find((v: Voucher) => 
      v.number === invoiceNumber && 
      ['SALES', 'PURCHASE'].includes(v.type)
    );

    if (voucher) {
      return transformVoucherToReturnFormat(voucher);
    }
  } catch (error) {
    console.error('Failed to fetch from local storage:', error);
  }

  return null;
}

/**
 * Transform backend invoice data to return format
 */
function transformInvoiceToReturnFormat(invoice: any): OriginalInvoiceData {
  const items: InvoiceItem[] = invoice.items.map((item: any) => ({
    id: item.id,
    productId: item.productId,
    productName: item.product?.name || 'Unknown Product',
    quantity: item.quantity,
    rate: item.rate,
    amount: item.amount,
    taxRate: item.taxRate || 0,
    godownId: item.godownId,
    returnedQuantity: 0,
    maxReturnableQuantity: item.quantity,
  }));

  return {
    id: invoice.id,
    type: invoice.type,
    number: invoice.number,
    date: invoice.date,
    partyName: invoice.customerName || invoice.supplierName || 'Unknown',
    partyLedgerId: invoice.customerLedgerId || invoice.supplierLedgerId || '',
    totalAmount: invoice.totalAmount,
    items,
    originalLines: [], // Will be populated when needed
  };
}

/**
 * Transform voucher data to return format
 */
function transformVoucherToReturnFormat(voucher: Voucher): OriginalInvoiceData {
  // Extract item information from voucher lines
  const items: InvoiceItem[] = voucher.lines
    .filter(line => line.itemId && line.quantity && line.debit === 0) // Sales/Purchase lines
    .map(line => ({
      id: line.itemId || '',
      productId: line.itemId || '',
      productName: `Item ${line.itemId}`,
      quantity: line.quantity || 0,
      rate: line.credit ? (line.credit / (line.quantity || 1)) : 0,
      amount: line.credit || 0,
      taxRate: 0, // Would need to be calculated or stored separately
      godownId: line.godownId,
      returnedQuantity: 0,
      maxReturnableQuantity: line.quantity || 0,
    }));

  // Extract party name from ledger lines
  const partyLine = voucher.lines.find(line => 
    (voucher.type === 'SALES' && line.debit > 0) || 
    (voucher.type === 'PURCHASE' && line.credit > 0)
  );

  return {
    id: voucher.id,
    type: voucher.type as 'SALES' | 'PURCHASE',
    number: voucher.number,
    date: voucher.date,
    partyName: `Party ${partyLine?.ledgerId || 'Unknown'}`,
    partyLedgerId: partyLine?.ledgerId || '',
    totalAmount: voucher.lines.reduce((sum, line) => sum + (line.debit || 0) + (line.credit || 0), 0) / 2,
    items,
    originalLines: voucher.lines,
  };
}

/**
 * Calculate return quantities and amounts
 */
export function calculateReturnTotals(items: InvoiceItem[]): VoucherTotals {
  const subtotal = items.reduce((sum, item) => {
    const returnQty = item.returnedQuantity || 0;
    return sum + (returnQty * item.rate);
  }, 0);

  const totalTax = items.reduce((sum, item) => {
    const returnQty = item.returnedQuantity || 0;
    const returnAmount = returnQty * item.rate;
    return sum + (returnAmount * item.taxRate / 100);
  }, 0);

  const grandTotal = subtotal + totalTax;

  // Always return VoucherTotals shape with taxBifurcated
  const totals: VoucherTotals = {
    subtotal,
    tax: totalTax,
    grandTotal,
    taxBifurcated: {
      type: 'CGST_SGST', // Default, will be overridden by caller
      cgst: totalTax / 2, // Default split, will be overridden by caller
      sgst: totalTax / 2,
      igst: 0,
      total: totalTax,
    },
  };

  return totals;
}

/**
 * Validate return quantities
 */
export function validateReturnQuantities(items: InvoiceItem[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  items.forEach((item, index) => {
    const returnQty = item.returnedQuantity || 0;
    if (returnQty < 0) {
      errors.push(`Item ${index + 1}: Return quantity cannot be negative`);
    }
    if (returnQty > item.maxReturnableQuantity) {
      errors.push(`Item ${index + 1}: Cannot return more than ${item.maxReturnableQuantity} units`);
    }
  });

  const totalReturnQty = items.reduce((sum, item) => sum + (item.returnedQuantity || 0), 0);
  if (totalReturnQty === 0) {
    errors.push('At least one item must have a return quantity');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
