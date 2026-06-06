import { useMemo } from 'react';

import { useAuth } from '../pages/contexts/auth';
import {
  isLikelyEmailUsername,
  readCachedDisplayName,
} from '../services/userDisplayNameService';

/** Logged-in user's display name (Firestore profile, cached locally). */
export function useUserDisplayName(): string {
  const { user } = useAuth();
  return useMemo(() => {
    const email = String(user?.email ?? '').trim();
    const full = String(user?.fullName ?? '').trim();
    if (full && !isLikelyEmailUsername(full, email)) return full;
    const cached = email ? readCachedDisplayName(email) : '';
    if (cached) return cached;
    return 'User';
  }, [user?.fullName, user?.email]);
}
