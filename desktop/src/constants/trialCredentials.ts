/** Public trial entry email — routes to trial OTP flow; no password stored in client. */
export const TRIAL_EMAIL = 'trial@pve360.com';

export const TRIAL_SUPPORT_WHATSAPP = '917549030630';
export const TRIAL_PURCHASE_URL = 'https://pve360.com/buy';

export function isTrialEmail(email: string): boolean {
  return email.trim().toLowerCase() === TRIAL_EMAIL;
}
