import type { PartyType } from './party';

export type PartyContactPerson = {
  id: string;
  salutation: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
};

export type PartyBankAccount = {
  id: string;
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName: string;
  city?: string;
  micr?: string;
  accountType: string;
};

export type PartyAddress = {
  attention: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
};

export type PartyDocumentRef = {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

export type PartyProfile = {
  partyId: string;
  customerType?: 'Business' | 'Individual';
  salutation?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  displayName?: string;
  website?: string;
  gstTreatment?: string;
  placeOfSupply?: string;
  pan?: string;
  tdsApplicable?: boolean;
  taxPreference?: string;
  currency?: string;
  paymentTerms?: string;
  priceListId?: string;
  openingBalanceAsOf?: string;
  creditLimit?: number;
  billingAddress?: PartyAddress;
  shippingAddress?: PartyAddress;
  shippingSameAsBilling?: boolean;
  contactPersons?: PartyContactPerson[];
  bankAccounts?: PartyBankAccount[];
  portalEnabled?: boolean;
  portalLanguage?: string;
  documents?: PartyDocumentRef[];
  reportingTags?: Record<string, string>;
  remarks?: string;
  updatedAt?: string;
};

export type PartyFullFormValues = {
  partyType: PartyType;
  name: string;
  mobile: string;
  gstin?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  email?: string;
  whatsapp?: string;
  openingBalance?: number;
  profile: Omit<PartyProfile, 'partyId'>;
};

export const emptyAddress = (): PartyAddress => ({
  attention: '',
  street1: '',
  street2: '',
  city: '',
  state: '',
  pinCode: '',
  country: 'India',
});

export const emptyBankAccount = (): PartyBankAccount => ({
  id: '',
  accountHolderName: '',
  accountNumber: '',
  confirmAccountNumber: '',
  ifscCode: '',
  bankName: '',
  branchName: '',
  accountType: 'Current',
});

export const emptyContactPerson = (id: string): PartyContactPerson => ({
  id,
  salutation: 'Mr',
  name: '',
  email: '',
  phone: '',
  designation: '',
});

export function buildDefaultPartyProfile(mode: 'customer' | 'vendor'): Omit<PartyProfile, 'partyId'> {
  return {
    customerType: mode === 'customer' ? 'Business' : undefined,
    salutation: 'Mr',
    firstName: '',
    lastName: '',
    companyName: '',
    displayName: '',
    website: '',
    gstTreatment: 'Unregistered Business',
    placeOfSupply: '',
    pan: '',
    tdsApplicable: false,
    taxPreference: 'Taxable',
    currency: 'INR',
    paymentTerms: 'Due on Receipt',
    priceListId: '',
    openingBalanceAsOf: new Date().toISOString().slice(0, 10),
    creditLimit: 0,
    billingAddress: emptyAddress(),
    shippingAddress: emptyAddress(),
    shippingSameAsBilling: true,
    contactPersons: [],
    bankAccounts: [emptyBankAccount()],
    portalEnabled: false,
    portalLanguage: 'English',
    documents: [],
    reportingTags: {},
    remarks: '',
  };
}
