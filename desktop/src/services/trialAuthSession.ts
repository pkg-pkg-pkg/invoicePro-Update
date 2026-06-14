import { TRIAL_EMAIL } from '../constants/trialCredentials';

export const TRIAL_SESSION_TOKEN = 'trial-session';

export function isTrialAuthSession(
  token?: string | null,
  user?: { email?: string; username?: string } | null
): boolean {
  if (token === TRIAL_SESSION_TOKEN) return true;
  const email = String(user?.email ?? user?.username ?? '')
    .trim()
    .toLowerCase();
  return email === TRIAL_EMAIL;
}
