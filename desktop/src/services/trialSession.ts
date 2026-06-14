import { TRIAL_EMAIL } from '../constants/trialCredentials';
import type { TrialCache } from './trialService';
import { maskMobile, saveTrialCache, setTrialUserFlag } from './trialService';
import { saveTrialKvMeta } from './localTrialService';
import { syncElectronStore } from './sync/syncElectronStore';

type AuthUser = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  companyId: string;
  company: null;
  completedBusinessProfile?: boolean;
};

export async function completeTrialAppLogin(
  login: (token: string, user: AuthUser) => Promise<void>,
  cache: TrialCache
): Promise<void> {
  await saveTrialCache(cache);
  await saveTrialKvMeta(cache.mobile_no, cache.device_id);
  setTrialUserFlag(true);
  await syncElectronStore.setSyncEnabled(false);
  await login('trial-session', {
    id: cache.phone_uid || `trial_${cache.mobile_no}`,
    username: TRIAL_EMAIL,
    email: TRIAL_EMAIL,
    fullName: `Trial User (+91 ${maskMobile(cache.mobile_no)})`,
    role: 'admin',
    companyId: '',
    company: null,
    completedBusinessProfile: false,
  });
}

export function buildTrialCache(params: {
  mobile_no: string;
  device_id: string;
  trial_end_seconds: number;
  days_remaining: number;
  city?: string;
  state?: string;
  phone_uid?: string;
}): TrialCache {
  return {
    mobile_no: params.mobile_no,
    device_id: params.device_id,
    trial_end_timestamp: params.trial_end_seconds,
    cached_at: Date.now(),
    days_remaining: params.days_remaining,
    status: 'VALID',
    city: params.city ?? '',
    state: params.state ?? '',
    phone_uid: params.phone_uid,
  };
}
