import type { SalesPipelineLineItem } from '../../types/salesDocuments';
import { amountToWordsINR } from '../voucherPrintBuilder';

export type SalesLineCalc = {
  discount: number;
  taxable: number;
  tax: number;
  amount: number;
};

export function calcSalesLine(line: Pick<SalesPipelineLineItem, 'qty' | 'rate' | 'discountPercent' | 'gstPercent'>): SalesLineCalc {
  const qty = Number(line.qty || 0);
  const rate = Number(line.rate || 0);
  const discountPercent = Number(line.discountPercent || 0);
  const gstPercent = Number(line.gstPercent || 0);
  const base = qty * rate;
  const discount = Number((base * (discountPercent / 100)).toFixed(2));
  const taxable = Number((base - discount).toFixed(2));
  const tax = Number((taxable * (gstPercent / 100)).toFixed(2));
  const amount = Number((taxable + tax).toFixed(2));
  return { discount, taxable, tax, amount };
}

export type SalesDocTotals = {
  subtotal: number;
  totalDiscount: number;
  taxableTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  freight: number;
  insurance: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
};

function readCompanyState(): string {
  try {
    const raw = localStorage.getItem('company-info');
    if (raw) {
      const p = JSON.parse(raw) as { state?: string };
      if (p.state?.trim()) return p.state.trim();
    }
    return localStorage.getItem('companyState')?.trim() || '';
  } catch {
    return '';
  }
}

function isInterState(placeOfSupply: string, companyState: string): boolean {
  if (!placeOfSupply.trim() || !companyState.trim()) return false;
  return placeOfSupply.trim().toLowerCase() !== companyState.trim().toLowerCase();
}

export function calcSalesDocumentTotals(
  lines: SalesPipelineLineItem[],
  opts: { freight?: number; insurance?: number; roundOff?: number; placeOfSupply?: string } = {}
): SalesDocTotals {
  const companyState = readCompanyState();
  const inter = isInterState(opts.placeOfSupply ?? companyState, companyState);
  let subtotal = 0;
  let totalDiscount = 0;
  let taxableTotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  for (const line of lines) {
    const c = calcSalesLine(line);
    subtotal += Number((line.qty * line.rate).toFixed(2));
    totalDiscount += c.discount;
    taxableTotal += c.taxable;
    if (inter) {
      igst += c.tax;
    } else {
      cgst += c.tax / 2;
      sgst += c.tax / 2;
    }
  }

  const freight = Number(opts.freight ?? 0);
  const insurance = Number(opts.insurance ?? 0);
  const roundOff = Number(opts.roundOff ?? 0);
  const grandTotal = Number(
    (taxableTotal + cgst + sgst + igst + freight + insurance + roundOff).toFixed(2)
  );

  return {
    subtotal: Number(subtotal.toFixed(2)),
    totalDiscount: Number(totalDiscount.toFixed(2)),
    taxableTotal: Number(taxableTotal.toFixed(2)),
    cgst: Number(cgst.toFixed(2)),
    sgst: Number(sgst.toFixed(2)),
    igst: Number(igst.toFixed(2)),
    freight,
    insurance,
    roundOff,
    grandTotal,
    amountInWords: amountToWordsINR(grandTotal),
  };
}

const NUMBER_PREFIX: Record<string, string> = {
  quotations: 'QUO',
  proforma: 'PRO',
  'sales-orders': 'SO',
  dispatch: 'DC',
  recurring: 'REC',
};

export function generatePipelineNumber(kind: string, existingCount: number, year = new Date().getFullYear()): string {
  const prefix = NUMBER_PREFIX[kind] ?? 'DOC';
  return `${prefix}-${year}-${String(existingCount + 1).padStart(3, '0')}`;
}
