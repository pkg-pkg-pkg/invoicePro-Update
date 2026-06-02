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
  /** Bank name for invoice footer / print templates */
  bank: string;
  accountNo: string;
  ifsc: string;
}

export function getNormalizedCompanyProfile(): NormalizedCompanyProfile {
  try {
    const raw = localStorage.getItem('company-info');
    const parsed: any = raw ? JSON.parse(raw) : {};
    const businessName = String(parsed?.businessName || parsed?.name || localStorage.getItem('companyName') || '').trim();
    const name = String(parsed?.businessName || parsed?.name || localStorage.getItem('companyName') || '').trim();
    const bank = String(parsed?.bank ?? parsed?.bankName ?? '').trim();
    const accountNo = String(
      parsed?.accountNo ?? parsed?.accountNumber ?? parsed?.bankAccountNo ?? ''
    ).trim();
    const ifsc = String(parsed?.ifsc ?? parsed?.ifscCode ?? parsed?.bankIfsc ?? '').trim();
    return {
      name,
      businessName,
      address: String(parsed?.address || '').trim(),
      gstin: String(parsed?.gstin || parsed?.gstNumber || localStorage.getItem('companyGSTIN') || '').trim(),
      phone: String(parsed?.phone || localStorage.getItem('companyPhone') || '').trim(),
      email: String(parsed?.email || localStorage.getItem('companyEmail') || '').trim(),
      website: String(parsed?.website || '').trim(),
      state: String(parsed?.state || '').trim(),
      city: String(parsed?.city || '').trim(),
      pinCode: String(parsed?.pinCode || '').trim(),
      logo: String(parsed?.logo || localStorage.getItem('companyLogo') || '').trim(),
      signature: String(parsed?.signature || localStorage.getItem('companySignature') || '').trim(),
      termsAndConditions: String(parsed?.termsAndConditions || '').trim(),
      bank,
      accountNo,
      ifsc,
    };
  } catch {
    return {
      name: '',
      businessName: '',
      address: '',
      gstin: '',
      phone: '',
      email: '',
      website: '',
      state: '',
      city: '',
      pinCode: '',
      logo: '',
      signature: '',
      termsAndConditions: '',
      bank: '',
      accountNo: '',
      ifsc: '',
    };
  }
}
