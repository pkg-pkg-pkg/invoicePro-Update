// Common constants

export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28] as const;

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
] as const;

export const UNITS_OF_MEASUREMENT = [
  'Pcs',
  'Kg',
  'Ltr',
  'Mtr',
  'Box',
  'Pack',
  'Dozen',
  'Gram',
  'Ton',
  'Quintal',
  'Sqft',
  'Sqmt'
] as const;

export const UQC_CODES = [
  { code: 'PCS', name: 'Piece' },
  { code: 'KGS', name: 'Kilograms' },
  { code: 'LTR', name: 'Litres' },
  { code: 'MTR', name: 'Metres' },
  { code: 'BOX', name: 'Box' },
  { code: 'PKT', name: 'Packet' },
  { code: 'DZN', name: 'Dozen' },
  { code: 'GRM', name: 'Gram' },
  { code: 'TON', name: 'Ton' },
  { code: 'QTL', name: 'Quintal' },
  { code: 'SQF', name: 'Square Feet' },
  { code: 'SQM', name: 'Square Metres' }
] as const;

export const INVOICE_TEMPLATES = [
  'Professional',
  'Compact',
  'Detailed',
  'Thermal'
] as const;

export const DATE_FORMATS = {
  DISPLAY: 'DD/MM/YYYY',
  DISPLAY_WITH_TIME: 'DD/MM/YYYY HH:mm',
  API: 'YYYY-MM-DD',
  API_WITH_TIME: 'YYYY-MM-DD HH:mm:ss'
} as const;

