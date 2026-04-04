// Common utility functions

export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (date: Date | string, format: string = 'DD/MM/YYYY'): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return format
    .replace('DD', day)
    .replace('MM', month)
    .replace('YYYY', year.toString())
    .replace('YY', year.toString().slice(-2));
};

export const calculateGST = (
  amount: number,
  gstRate: number,
  transactionType: 'INTRA_STATE' | 'INTER_STATE'
): { cgst: number; sgst: number; igst: number; totalTax: number } => {
  const taxAmount = (amount * gstRate) / 100;
  
  if (transactionType === 'INTRA_STATE') {
    const cgst = taxAmount / 2;
    const sgst = taxAmount / 2;
    return { cgst, sgst, igst: 0, totalTax: taxAmount };
  } else {
    return { cgst: 0, sgst: 0, igst: taxAmount, totalTax: taxAmount };
  }
};

export const generateInvoiceNumber = (
  prefix: string,
  sequence: number,
  date: Date
): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(4, '0');
  return `${prefix}/${year}-${month}/${seq}`;
};

export const validateGSTIN = (gstin: string): boolean => {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
};

export const validatePAN = (pan: string): boolean => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan);
};

export const roundOff = (amount: number): number => {
  return Math.round(amount);
};

export const calculateDiscount = (
  amount: number,
  discount: number,
  type: 'PERCENTAGE' | 'FIXED'
): number => {
  if (type === 'PERCENTAGE') {
    return (amount * discount) / 100;
  }
  return discount;
};

