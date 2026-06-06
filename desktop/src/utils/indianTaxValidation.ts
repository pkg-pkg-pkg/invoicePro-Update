const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;
const PIN_REGEX = /^\d{6}$/;

/** GST state code (first 2 digits of GSTIN) → state/UT name */
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

export function normalizeGstin(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizePan(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidGstin(value: string): boolean {
  const v = normalizeGstin(value);
  return v.length === 15 && GSTIN_REGEX.test(v);
}

export function gstinStateName(value: string): string | null {
  const v = normalizeGstin(value);
  if (v.length < 2) return null;
  return GST_STATE_CODES[v.slice(0, 2)] ?? null;
}

export function validateGstinField(value: string): string | undefined {
  const v = normalizeGstin(value);
  if (!v) return undefined;
  if (!isValidGstin(v)) return 'Invalid GSTIN (15 chars: state + PAN + check digit)';
  return undefined;
}

export function isValidPan(value: string): boolean {
  const v = normalizePan(value);
  return v.length === 10 && PAN_REGEX.test(v);
}

export function validatePanField(value: string): string | undefined {
  const v = normalizePan(value);
  if (!v) return undefined;
  if (!isValidPan(v)) return 'Invalid PAN (format: ABCDE1234F)';
  return undefined;
}

export function normalizeIndianMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function isValidIndianMobile(value: string): boolean {
  return MOBILE_REGEX.test(normalizeIndianMobile(value));
}

export function validateIndianMobileField(value: string, required = false): string | undefined {
  const digits = normalizeIndianMobile(value);
  if (!digits) return required ? 'Mobile number is required' : undefined;
  if (!MOBILE_REGEX.test(digits)) return 'Enter valid 10-digit mobile (starts with 6–9)';
  return undefined;
}

export function isValidPinCode(value: string): boolean {
  return PIN_REGEX.test(value.replace(/\D/g, ''));
}

export function validatePinCodeField(value: string, required = false): string | undefined {
  const pin = value.replace(/\D/g, '');
  if (!pin) return required ? 'PIN code is required' : undefined;
  if (!PIN_REGEX.test(pin)) return 'PIN must be 6 digits';
  return undefined;
}

export const GST_TREATMENTS = [
  'Registered Business - Regular',
  'Registered Business - Composition',
  'Unregistered Business',
  'Consumer',
  'Overseas',
  'Special Economic Zone',
] as const;

export const PAYMENT_TERMS_OPTIONS = [
  'Due on Receipt',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
] as const;

export const SALUTATIONS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'] as const;

export const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED'] as const;

export const BANK_ACCOUNT_TYPES = ['Current', 'Savings', 'CC', 'OD'] as const;

export const TAX_PREFERENCES = ['Taxable', 'Tax Exempt'] as const;
