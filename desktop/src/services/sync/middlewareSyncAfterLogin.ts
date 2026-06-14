import { isTrialAuthSession } from '../trialAuthSession';

type LoginUser = { email?: string; username?: string };

/** Lazy middleware sync — never runs for trial sessions; never blocks login. */
export async function scheduleMiddlewareSyncAfterLogin(
  token: string | null,
  user: LoginUser | null
): Promise<void> {
  if (isTrialAuthSession(token, user)) {
    return;
  }

  try {
    const { shouldAttemptMiddlewareSync, ensureSyncReady } = await import('./middlewareSyncAuth');
    const { schedulePostLoginDrain } = await import('./invoiceProMiddlewareSync');

    if (!(await shouldAttemptMiddlewareSync())) {
      return;
    }

    const ok = await ensureSyncReady();
    if (ok) {
      schedulePostLoginDrain();
    }
  } catch (err) {
    console.warn('[middleware-sync] post-login setup skipped:', err);
  }
}
