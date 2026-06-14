/** Shared Tally-style line pricing: rates, discount, GST base. */

export interface VoucherLinePricingFields {
  quantity: string;
  mrp?: string;
  rateExclusive: string;
  rateInclusive: string;
  taxRate: string;
  discountPercent?: string;
  discountAmount?: string;
}

export const pricingToNumber = (value: string | number | undefined, precision = 2): number => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(precision));
};

export const formatPricingNumber = (value: number, precision = 2): string => {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(precision);
};

export const rateInclusiveFromExclusive = (exclusive: number, taxRate: number): number => {
  if (exclusive <= 0) return 0;
  return pricingToNumber(exclusive * (1 + taxRate / 100));
};

export const rateExclusiveFromInclusive = (inclusive: number, taxRate: number): number => {
  if (inclusive <= 0) return 0;
  const factor = 1 + taxRate / 100;
  if (factor <= 0) return inclusive;
  return pricingToNumber(inclusive / factor);
};

export const discountAmountFromPercent = (rateExclusive: number, discountPercent: number): number => {
  if (rateExclusive <= 0 || discountPercent <= 0) return 0;
  return pricingToNumber((rateExclusive * discountPercent) / 100);
};

export const discountPercentFromAmount = (rateExclusive: number, discountAmount: number): number => {
  if (rateExclusive <= 0 || discountAmount <= 0) return 0;
  return pricingToNumber((discountAmount / rateExclusive) * 100);
};

export const resolveLineDiscountAmount = (line: VoucherLinePricingFields): number => {
  const rateEx = pricingToNumber(line.rateExclusive);
  if (rateEx <= 0) return 0;
  const discAmtRaw = pricingToNumber(line.discountAmount);
  if (discAmtRaw > 0) return Math.min(discAmtRaw, rateEx);
  const discPct = pricingToNumber(line.discountPercent);
  if (discPct > 0) return discountAmountFromPercent(rateEx, discPct);
  return 0;
};

export const resolveLineDiscountPercent = (line: VoucherLinePricingFields): number => {
  const rateEx = pricingToNumber(line.rateExclusive);
  if (rateEx <= 0) return 0;
  const discPct = pricingToNumber(line.discountPercent);
  if (discPct > 0) return discPct;
  const discAmt = pricingToNumber(line.discountAmount);
  if (discAmt > 0) return discountPercentFromAmount(rateEx, discAmt);
  return 0;
};

export const netRateExclusive = (line: VoucherLinePricingFields): number => {
  const rateEx = pricingToNumber(line.rateExclusive);
  return pricingToNumber(Math.max(0, rateEx - resolveLineDiscountAmount(line)));
};

export const computeLineTaxableAmount = (line: VoucherLinePricingFields): number => {
  const qty = pricingToNumber(line.quantity);
  return pricingToNumber(netRateExclusive(line) * qty);
};

export const computeLineTaxAmount = (line: VoucherLinePricingFields): number => {
  const base = computeLineTaxableAmount(line);
  const taxRate = pricingToNumber(line.taxRate);
  return pricingToNumber((base * taxRate) / 100);
};

export const computeLineDiscountTotal = (line: VoucherLinePricingFields): number => {
  const qty = pricingToNumber(line.quantity);
  return pricingToNumber(resolveLineDiscountAmount(line) * qty);
};

export const discOnMrpPercent = (mrp: number, rateExclusive: number): number | null => {
  if (mrp <= 0 || rateExclusive <= 0 || rateExclusive > mrp) return null;
  return pricingToNumber(((mrp - rateExclusive) / mrp) * 100);
};

export function applyExclusiveRateEdit(
  value: string,
  taxRate: string
): Pick<VoucherLinePricingFields, 'rateExclusive' | 'rateInclusive'> {
  if (!value) return { rateExclusive: '', rateInclusive: '' };
  const exclusive = Number(value);
  const tax = pricingToNumber(taxRate);
  const inclusive = rateInclusiveFromExclusive(exclusive, tax);
  return {
    rateExclusive: value,
    rateInclusive: inclusive > 0 ? formatPricingNumber(inclusive) : '',
  };
}

export function applyInclusiveRateEdit(
  value: string,
  taxRate: string
): Pick<VoucherLinePricingFields, 'rateExclusive' | 'rateInclusive'> {
  if (!value) return { rateExclusive: '', rateInclusive: '' };
  const inclusive = Number(value);
  const tax = pricingToNumber(taxRate);
  const exclusive = rateExclusiveFromInclusive(inclusive, tax);
  return {
    rateInclusive: value,
    rateExclusive: exclusive > 0 ? formatPricingNumber(exclusive) : '',
  };
}

export function applyDiscountPercentEdit(
  value: string,
  rateExclusive: string
): Pick<VoucherLinePricingFields, 'discountPercent' | 'discountAmount'> {
  const rateEx = pricingToNumber(rateExclusive);
  if (!value || rateEx <= 0) {
    return { discountPercent: value, discountAmount: value ? '0' : '' };
  }
  const pct = pricingToNumber(value);
  const amt = discountAmountFromPercent(rateEx, pct);
  return {
    discountPercent: value,
    discountAmount: amt > 0 ? formatPricingNumber(amt) : '0',
  };
}

export function applyDiscountAmountEdit(
  value: string,
  rateExclusive: string
): Pick<VoucherLinePricingFields, 'discountPercent' | 'discountAmount'> {
  const rateEx = pricingToNumber(rateExclusive);
  if (!value || rateEx <= 0) {
    return { discountAmount: value, discountPercent: value ? '0' : '' };
  }
  const amt = Math.min(pricingToNumber(value), rateEx);
  const pct = discountPercentFromAmount(rateEx, amt);
  return {
    discountAmount: formatPricingNumber(amt),
    discountPercent: pct > 0 ? formatPricingNumber(pct) : '0',
  };
}

export function applyTaxRateEdit(
  taxRate: string,
  rateExclusive: string,
  rateInclusive: string,
  prefer: 'exclusive' | 'inclusive' = 'exclusive'
): Pick<VoucherLinePricingFields, 'rateExclusive' | 'rateInclusive' | 'taxRate'> {
  const tax = pricingToNumber(taxRate);
  if (prefer === 'inclusive' && rateInclusive) {
    const patch = applyInclusiveRateEdit(rateInclusive, taxRate);
    return { ...patch, taxRate };
  }
  if (rateExclusive) {
    const patch = applyExclusiveRateEdit(rateExclusive, taxRate);
    return { ...patch, taxRate };
  }
  return { taxRate, rateExclusive, rateInclusive };
}

export const isPricingLineValid = (line: VoucherLinePricingFields): boolean =>
  pricingToNumber(line.quantity) > 0 && netRateExclusive(line) > 0;
