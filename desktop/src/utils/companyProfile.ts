import {
  getCachedCompanyProfile,
  preloadCompanyProfile,
} from '../services/companyProfileDbService';

export interface NormalizedCompanyProfile {
  name: string;
  businessName: string;
  address: string;
  gstin: string;
  phone: string;
  email: string;
  website: string;
  state: string;
  city: string;
  pinCode: string;
  logo: string;
  signature: string;
  termsAndConditions: string;
  bank: string;
  accountNo: string;
  ifsc: string;
}

export { preloadCompanyProfile };

/** Sync read from SQLite-backed in-memory cache (warm via preloadCompanyProfile on startup). */
export function getNormalizedCompanyProfile(): NormalizedCompanyProfile {
  return getCachedCompanyProfile();
}
