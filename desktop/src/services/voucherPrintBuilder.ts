import { Voucher } from '../types/vouchers';
import { LedgerAccount } from '../types/masters';
import type { InvoicePaperSize } from '../templates/invoice/invoiceTemplatesConfig';
import { normalizePaperSize } from '../templates/invoice/invoiceTemplatesConfig';
import {
  buildInvoiceHTML,
  CompanyInfo,
  DEFAULT_INVOICE_PRINT_OPTIONS,
  InvoiceData,
  paperSizeToFormat,
} from './printService';
import { buildEwayPrintBlock } from './ewayBillService';
import { getNormalizedCompanyProfile } from '../utils/companyProfile';

export const amountToWordsINR = (amount: number): string => {
  const n = Math.round(Number(amount || 0));
  if (n <= 0) return 'Zero Rupees Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigits = (x: number) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ''}`.trim());
  const threeDigits = (x: number) => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return `${h ? `${ones[h]} Hundred${r ? ' ' : ''}` : ''}${r ? twoDigits(r) : ''}`.trim();
  };
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const chunks = [
    crore ? `${threeDigits(crore)} Crore` : '',
    lakh ? `${threeDigits(lakh)} Lakh` : '',
    thousand ? `${threeDigits(thousand)} Thousand` : '',
    rest ? threeDigits(rest) : '',
  ].filter(Boolean);
  return `${chunks.join(' ')} Rupees Only`;
};

export const voucherGrandTotal = (voucher: Voucher): number => {
  const debit = voucher.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = voucher.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  return Math.max(debit, credit);
};

export const loadCompanyForPrint = (): CompanyInfo => {
  const p = getNormalizedCompanyProfile();
  return {
    name: p.businessName || p.name || '',
    address: p.address || '',
    gstin: p.gstin || '',
    phone: p.phone || '',
    email: p.email || '',
    website: p.website || '',
    city: p.city || '',
    pinCode: p.pinCode || '',
    bank: p.bank || '',
    accountNo: p.accountNo || '',
    ifsc: p.ifsc || '',
    logo: p.logo || undefined,
    signature: p.signature || undefined,
  };
};

const ledgerLabel = (ledgerId: string, ledgerNameMap: Map<string, string>) =>
  ledgerNameMap.get(ledgerId) ?? ledgerId;

const taxFromLedgerName = (name: string, amount: number, totals: { cgst: number; sgst: number; igst: number }) => {
  const upper = name.toUpperCase();
  if (upper.includes('CGST')) totals.cgst += amount;
  else if (upper.includes('SGST')) totals.sgst += amount;
  else if (upper.includes('IGST')) totals.igst += amount;
};

export interface BuildSalesVoucherPrintInput {
  voucher: Voucher;
  itemNameMap: Map<string, string>;
  ledgerNameMap: Map<string, string>;
  customerLedger?: LedgerAccount | null;
  pageSize?: InvoicePaperSize | string;
  dueDate?: string;
  termsAndConditions?: string;
  discountTotal?: number;
  roundOff?: number;
}

export const buildSalesVoucherInvoiceHtml = async (
  input: BuildSalesVoucherPrintInput
): Promise<{
  html: string;
  fileName: string;
}> => {
  const { voucher, itemNameMap, ledgerNameMap, customerLedger, dueDate, termsAndConditions } = input;
  const company = loadCompanyForPrint();
  const format = paperSizeToFormat(input.pageSize || 'A4');

  const customerLine = voucher.lines.find((line) => (line.debit ?? 0) > 0);
  const customerName =
    customerLedger?.name ||
    (customerLine ? ledgerLabel(customerLine.ledgerId, ledgerNameMap) : '');

  const itemLines = voucher.lines.filter((line) => line.itemId && Number(line.quantity || 0) > 0);
  const subtotal = itemLines.reduce((sum, line) => sum + Number(line.credit || line.debit || 0), 0);

  const taxTotals = { cgst: 0, sgst: 0, igst: 0 };
  voucher.lines.forEach((line) => {
    if (line.itemId) return;
    const name = ledgerLabel(line.ledgerId, ledgerNameMap);
    const amount = Number(line.credit || line.debit || 0);
    if (line.cgstAmount) taxTotals.cgst += Number(line.cgstAmount);
    if (line.sgstAmount) taxTotals.sgst += Number(line.sgstAmount);
    if (line.igstAmount) taxTotals.igst += Number(line.igstAmount);
    if (!line.cgstAmount && !line.sgstAmount && !line.igstAmount) {
      taxFromLedgerName(name, amount, taxTotals);
    }
  });

  const grandTotal = voucherGrandTotal(voucher);
  const prevBalance = Number(customerLedger?.currentBalance ?? NaN);
  const items = itemLines.map((line) => {
    const qty = Number(line.quantity || 0);
    const amount = Number(line.credit || line.debit || 0);
    const rate = qty > 0 ? amount / qty : amount;
    return {
      name: itemNameMap.get(String(line.itemId)) ?? String(line.itemId),
      hsn: '',
      qty,
      rate,
      taxPercent: 0,
      amount,
      cgst: Number(line.cgstAmount || 0),
      sgst: Number(line.sgstAmount || 0),
      igst: Number(line.igstAmount || 0),
    };
  });

  const roundOffLine = voucher.lines.find((l) =>
    ledgerLabel(l.ledgerId, ledgerNameMap).toUpperCase().includes('ROUND')
  );
  const roundOff = input.roundOff ?? Number(roundOffLine?.credit || roundOffLine?.debit || 0);

  const invoiceData: InvoiceData = {
    invoiceNumber: voucher.number,
    invoiceDate: voucher.date,
    dueDate,
    customerName,
    customerGSTIN: String(customerLedger?.gstDetails?.gstin || ''),
    customerPhone: String(customerLedger?.contactDetails?.phone || ''),
    buyerAddress: String(customerLedger?.contactDetails?.address || ''),
    sellerAddress: String(company.address || ''),
    billToAddress: String(customerLedger?.contactDetails?.address || ''),
    shipToAddress: String(customerLedger?.contactDetails?.address || ''),
    customerSealLabel: 'Customer Seal & Signature',
    items,
    subtotal,
    cgstTotal: taxTotals.cgst,
    sgstTotal: taxTotals.sgst,
    igstTotal: taxTotals.igst,
    discountTotal: input.discountTotal ?? 0,
    roundOff,
    grandTotal,
    amountInWords: amountToWordsINR(grandTotal),
    termsAndConditions: termsAndConditions || undefined,
    declaration:
      'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    ewayBillBlock: buildEwayPrintBlock(voucher.ewayBill),
    buyerState: '',
    prevBalance: Number.isFinite(prevBalance) ? prevBalance : undefined,
  };

  const html = await buildInvoiceHTML(format, company, invoiceData, DEFAULT_INVOICE_PRINT_OPTIONS);
  const safeNumber = voucher.number.replace(/[^\w.-]+/g, '_');
  return { html, fileName: `${safeNumber}.pdf` };
};

export const buildWhatsAppShareUrl = (voucher: Voucher, phone?: string): string => {
  const amount = voucherGrandTotal(voucher).toFixed(2);
  const date = new Date(voucher.date).toLocaleDateString('en-IN');
  const msg = encodeURIComponent(
    `Invoice ${voucher.number}\nDate: ${date}\nAmount: ₹${amount}\nThank you for your business!`
  );
  const digits = String(phone || '').replace(/\D/g, '');
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${intl || ''}?text=${msg}`;
};
