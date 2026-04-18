import api from './api';
import { APP_DISPLAY_NAME, APP_VERSION } from '@/constants/appBranding';

export interface FeedbackPayload {
  category: string;
  subject: string;
  message: string;
}

function normalizeSendResult(raw: unknown): { success: boolean; message: string } {
  if (raw && typeof raw === 'object' && 'success' in raw) {
    const o = raw as { success?: unknown; message?: unknown };
    return {
      success: Boolean(o.success),
      message: String(o.message ?? 'Thank you! Your feedback has been sent.'),
    };
  }
  return { success: true, message: 'Thank you! Your feedback has been sent.' };
}

class FeedbackService {
  private getContext() {
    const userRaw = localStorage.getItem('user');
    let user: any = null;
    try {
      user = userRaw ? JSON.parse(userRaw) : null;
    } catch {
      user = null;
    }
    const userEmail =
      String(user?.email ?? '').trim() ||
      localStorage.getItem('userEmail') ||
      localStorage.getItem('lastLoginEmail') ||
      'Unknown User';
    const userName =
      String(user?.fullName ?? user?.name ?? user?.username ?? '').trim() ||
      localStorage.getItem('userName') ||
      'Unknown';
    const companyName = localStorage.getItem('companyName') || 'Unknown Company';
    return { userEmail, userName, companyName };
  }

  private queueFallbackFeedback(
    payload: FeedbackPayload,
    context: { userEmail: string; userName: string; companyName: string }
  ) {
    try {
      const key = 'pve_feedback_outbox';
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(list) ? list : [];
      next.push({
        id: `fb-${Date.now()}`,
        payload,
        ...context,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(next.slice(-100)));
    } catch {
      // ignore queue errors
    }
  }

  private openMailDraft(subject: string, body: string): void {
    const mailto = `mailto:pve.2020@hotmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      window.open(mailto, '_blank');
    } catch {
      try {
        window.location.href = mailto;
      } catch {
        // ignore
      }
    }
  }

  /**
   * Send feedback to developer (API when online; mail draft + local queue as fallback).
   */
  async sendFeedback(payload: FeedbackPayload): Promise<{ success: boolean; message: string }> {
    const context = this.getContext();
    try {
      const response = await api.post('/feedback/send', {
        ...payload,
        ...context,
        timestamp: new Date().toISOString(),
        appVersion: APP_VERSION,
      });
      return normalizeSendResult(response?.data);
    } catch (error: any) {
      console.error('Error sending feedback:', error);
      return this.sendFeedbackViaMail(payload, context);
    }
  }

  private async sendFeedbackViaMail(
    payload: FeedbackPayload,
    context?: { userEmail: string; userName: string; companyName: string }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { userEmail, userName, companyName } = context ?? this.getContext();

      const emailBody = `
NEW FEEDBACK RECEIVED
====================

Category: ${payload.category}
From: ${userName} (${userEmail})
Company: ${companyName}

Subject: ${payload.subject}

Message:
${payload.message}

---
Sent via ${APP_DISPLAY_NAME} v${APP_VERSION}
Timestamp: ${new Date().toISOString()}
      `.trim();

      this.queueFallbackFeedback(payload, { userEmail, userName, companyName });
      this.openMailDraft(`[${payload.category.toUpperCase()}] ${payload.subject}`, emailBody);
      return {
        success: true,
        message: 'Feedback saved locally and mail draft opened. Please send the email to complete delivery.',
      };
    } catch (error) {
      console.error('Fallback email send failed:', error);
      return { success: true, message: 'Feedback saved locally. Support can collect it from this device.' };
    }
  }
}

const feedbackService = new FeedbackService();
export { feedbackService };
export default feedbackService;
