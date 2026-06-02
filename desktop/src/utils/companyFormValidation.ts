const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_REGEX = /^\d{6}$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;

export type CompanyFormValues = {
  name: string;
  gstin: string;
  ownerName: string;
  businessType: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  pinCode: string;
  mobile: string;
  email: string;
  website: string;
  fyStartYear: number;
};

export type CompanyFormErrors = Partial<Record<keyof CompanyFormValues, string>>;

export function validateCompanyName(value: string): string | undefined {
  const v = value.trim();
  if (!v) return 'Company name is required';
  if (v.length < 3) return 'Company name must be at least 3 characters';
  return undefined;
}

export function validateGstin(value: string): string | undefined {
  const v = value.trim().toUpperCase();
  if (!v) return undefined;
  if (v.length !== 15 || !GSTIN_REGEX.test(v)) {
    return 'Enter a valid 15-character GSTIN (e.g. 20BLPPK9138J1ZS)';
  }
  return undefined;
}

export function validateAddressLine1(value: string): string | undefined {
  if (!value.trim()) return 'Address line 1 is required';
  return undefined;
}

export function validateCity(value: string): string | undefined {
  if (!value.trim()) return 'City is required';
  return undefined;
}

export function validateState(value: string): string | undefined {
  if (!value.trim()) return 'State is required';
  return undefined;
}

export function validatePinCode(value: string): string | undefined {
  const v = value.trim();
  if (!v) return 'PIN code is required';
  if (!PIN_REGEX.test(v)) return 'PIN code must be exactly 6 digits';
  return undefined;
}

export function validateMobile(value: string): string | undefined {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 'Mobile number is required';
  if (!MOBILE_REGEX.test(digits)) return 'Enter a valid 10-digit mobile (starts with 6–9)';
  return undefined;
}

export function validateEmail(value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (!EMAIL_REGEX.test(v)) return 'Enter a valid email address';
  return undefined;
}

export function validateCompanyForm(values: CompanyFormValues): CompanyFormErrors {
  const errors: CompanyFormErrors = {};
  const nameErr = validateCompanyName(values.name);
  if (nameErr) errors.name = nameErr;
  const gstErr = validateGstin(values.gstin);
  if (gstErr) errors.gstin = gstErr;
  const a1 = validateAddressLine1(values.addressLine1);
  if (a1) errors.addressLine1 = a1;
  const cityErr = validateCity(values.city);
  if (cityErr) errors.city = cityErr;
  const stateErr = validateState(values.state);
  if (stateErr) errors.state = stateErr;
  const pinErr = validatePinCode(values.pinCode);
  if (pinErr) errors.pinCode = pinErr;
  const mobErr = validateMobile(values.mobile);
  if (mobErr) errors.mobile = mobErr;
  const emailErr = validateEmail(values.email);
  if (emailErr) errors.email = emailErr;
  return errors;
}

export function buildProfilePayload(values: CompanyFormValues) {
  const line1 = values.addressLine1.trim();
  const line2 = values.addressLine2.trim();
  const city = values.city.trim();
  const district = values.district.trim();
  const state = values.state.trim();
  const pin = values.pinCode.replace(/\D/g, '');
  const mobile = values.mobile.replace(/\D/g, '');
  const address = [line1, line2].filter(Boolean).join(', ');
  const loc = [city, district, state].filter(Boolean).join(', ');
  const statePin = pin ? `${loc} - ${pin}` : loc;

  return {
    name: values.name.trim(),
    gstin: values.gstin.trim().toUpperCase(),
    ownerName: values.ownerName.trim(),
    businessType: values.businessType.trim(),
    fyStartYear: Number(values.fyStartYear),
    addressLine1: line1,
    addressLine2: line2,
    city,
    district,
    state,
    pinCode: pin,
    address,
    statePin,
    mobiles: mobile,
    email: values.email.trim(),
    website: values.website.trim(),
  };
}
