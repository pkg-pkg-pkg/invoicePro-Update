export const BUSINESS_TYPES = [
  'Proprietorship',
  'Partnership',
  'Private Limited (Pvt. Ltd.)',
  'Public Limited',
  'LLP',
  'HUF',
  'Trust / NGO',
  'Other',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];
