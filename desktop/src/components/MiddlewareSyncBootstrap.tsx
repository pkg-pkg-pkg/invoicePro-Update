import { useEffect } from 'react';
import { useAuth } from '../pages/contexts/auth';
import { isTrialAuthSession } from '../services/trialAuthSession';

/** Wires online listeners + post-login queue drain (licensed users only). */
export default function MiddlewareSyncBootstrap() {
  const { isAuthenticated, token, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || isTrialAuthSession(token, user)) return;

    void import('../services/sync/invoiceProMiddlewareSync').then(({ initDrainListeners }) => {
      initDrainListeners();
    });
  }, [isAuthenticated, token, user]);

  useEffect(() => {
    if (!isAuthenticated || isTrialAuthSession(token, user)) return;

    void import('../services/sync/middlewareSyncAfterLogin').then(({ scheduleMiddlewareSyncAfterLogin }) =>
      scheduleMiddlewareSyncAfterLogin(token, user)
    );
  }, [isAuthenticated, token, user]);

  return null;
}
