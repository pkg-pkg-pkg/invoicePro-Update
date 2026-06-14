import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/firebase';
import type { TrialRecord } from '../utils/trialHelpers';

export async function listAllTrials(): Promise<TrialRecord[]> {
  const snap = await getDocs(collection(db, 'trials'));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<TrialRecord, 'id'>) }))
    .sort((a, b) => {
      const aMs = a.created_at?.toMillis?.() ?? 0;
      const bMs = b.created_at?.toMillis?.() ?? 0;
      return bMs - aMs;
    });
}

export async function extendTrialMobile(mobileNo: string, extraDays = 7): Promise<void> {
  const fn = httpsCallable(functions, 'extendTrial');
  const res = await fn({ mobile_no: mobileNo, extra_days: extraDays });
  const data = res.data as { success?: boolean; error?: string };
  if (!data?.success) throw new Error(data?.error || 'Extend failed');
}

export async function runTrialAdminAction(
  mobileNo: string,
  action: 'reset_device' | 'mark_converted' | 'block'
): Promise<void> {
  const fn = httpsCallable(functions, 'adminTrialAction');
  await fn({ mobile_no: mobileNo, action });
}
