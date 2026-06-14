import api from '../api';
import { APP_DISPLAY_NAME, APP_VERSION } from '@/constants/appBranding';
import type { PrivacyFeedbackPayload } from '../../types/privacyDiagnostics';
import { assertDiagnosticsPayloadSafe } from './diagnosticsService';
import { isElectronRuntime } from '../../utils/runtime';

const FEEDBACK_OUTBOX_KEY = 'pve_privacy_feedback_outbox_v1';

export type PrivacyFeedbackResult = { success: boolean; message: string };

function queuePrivacyFeedback(entry: PrivacyFeedbackPayload & { submittedAt: string }) {
  try {
    const raw = localStorage.getItem(FEEDBACK_OUTBOX_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(list) ? list : [];
    next.push({ id: `pf-${Date.now()}`, ...entry });
    localStorage.setItem(FEEDBACK_OUTBOX_KEY, JSON.stringify(next.slice(-100)));
  } catch {
    // ignore
  }
}

async function tryFirebaseCallable(entry: PrivacyFeedbackPayload & { submittedAt: string }): Promise<boolean> {
  if (!isElectronRuntime() || !window.electronAPI?.firebaseCallable) return false;
  try {
    const { auth } = await import('../../firebase/firebase');
    const user = auth?.currentUser;
    if (!user) return false;
    const idToken = await user.getIdToken();
    const res = await window.electronAPI.firebaseCallable({
      name: 'submitPrivacyFeedback',
      data: entry,
      idToken,
    });
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

class PrivacyFeedbackService {
  async send(payload: PrivacyFeedbackPayload): Promise<PrivacyFeedbackResult> {
    if (payload.diagnostics) {
      assertDiagnosticsPayloadSafe(payload.diagnostics);
    }

    const entry = {
      ...payload,
      submittedAt: new Date().toISOString(),
      app: APP_DISPLAY_NAME,
      appVersion: APP_VERSION,
    };

    queuePrivacyFeedback(entry);

    const sentViaFirebase = await tryFirebaseCallable(entry);
    if (sentViaFirebase) {
      return {
        success: true,
        message: 'Thank you. Your feedback was sent securely to PVE.',
      };
    }

    try {
      await api.post('/feedback/privacy', entry);
      return {
        success: true,
        message: 'Thank you. Your feedback was sent to PVE.',
      };
    } catch {
      return {
        success: true,
        message:
          'Thank you. Your feedback is saved on this device and will be sent when connectivity is available. No financial or customer data was included.',
      };
    }
  }
}

export const privacyFeedbackService = new PrivacyFeedbackService();

/** @deprecated Use privacyFeedbackService via FeedbackDialog */
export { privacyFeedbackService as feedbackServiceExtension };
