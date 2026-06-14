export type IfscLookupResult = {
  BANK: string;
  BRANCH: string;
  ADDRESS?: string;
  CITY?: string;
  STATE?: string;
  MICR?: string;
  IFSC?: string;
};

export type IfscLookupErrorKind = 'invalid' | 'network' | 'validation';

export class IfscLookupError extends Error {
  readonly kind: IfscLookupErrorKind;

  constructor(message: string, kind: IfscLookupErrorKind) {
    super(message);
    this.name = 'IfscLookupError';
    this.kind = kind;
  }
}

export async function lookupIfsc(ifscRaw: string): Promise<IfscLookupResult> {
  const ifsc = ifscRaw.trim().toUpperCase();
  if (ifsc.length !== 11) {
    throw new IfscLookupError('IFSC must be 11 characters', 'validation');
  }
  if (!/^[A-Z0-9]{11}$/.test(ifsc)) {
    throw new IfscLookupError('IFSC must be 11 alphanumeric characters', 'validation');
  }

  let res: Response;
  try {
    res = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifsc)}`);
  } catch {
    throw new IfscLookupError(
      'Could not fetch bank details — please fill manually',
      'network'
    );
  }

  if (res.status === 404) {
    throw new IfscLookupError('Invalid IFSC code — please check and retry', 'invalid');
  }
  if (!res.ok) {
    throw new IfscLookupError(
      'Could not fetch bank details — please fill manually',
      'network'
    );
  }

  let data: IfscLookupResult;
  try {
    data = (await res.json()) as IfscLookupResult;
  } catch {
    throw new IfscLookupError(
      'Could not fetch bank details — please fill manually',
      'network'
    );
  }

  if (!data?.BANK) {
    throw new IfscLookupError('Invalid IFSC code — please check and retry', 'invalid');
  }
  return data;
}
