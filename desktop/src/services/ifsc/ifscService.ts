export type IfscLookupResult = {
  BANK: string;
  BRANCH: string;
  ADDRESS?: string;
  CITY?: string;
  STATE?: string;
  MICR?: string;
  IFSC?: string;
};

export async function lookupIfsc(ifscRaw: string): Promise<IfscLookupResult> {
  const ifsc = ifscRaw.trim().toUpperCase();
  if (ifsc.length !== 11) {
    throw new Error('IFSC must be 11 characters');
  }
  const res = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifsc)}`);
  if (res.status === 404) {
    throw new Error('Invalid IFSC code');
  }
  if (!res.ok) {
    throw new Error('Could not validate IFSC. Try again.');
  }
  const data = (await res.json()) as IfscLookupResult;
  if (!data?.BANK) {
    throw new Error('Invalid IFSC code');
  }
  return data;
}
