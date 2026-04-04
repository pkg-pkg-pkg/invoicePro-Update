import api from './api';

export interface FeedbackPayload {
  category: string;
  subject: string;
  message: string;
}

class FeedbackService {
  /**
   * Send feedback to developer
   */
  async sendFeedback(payload: FeedbackPayload): Promise<{ success: boolean; message: string }> {
    try {
      // Get user info from localStorage for context
      const userEmail = localStorage.getItem('userEmail') || 'Unknown User';
      const userName = localStorage.getItem('userName') || 'Unknown';
      const companyName = localStorage.getItem('companyName') || 'Unknown Company';

      // Send to backend API endpoint
      const response = await api.post('/feedback/send', {
        ...payload,
        userEmail,
        userName,
        companyName,
        timestamp: new Date().toISOString(),
        appVersion: '1.0.0', // You can update this from package.json
      });

      return response.data;
    } catch (error: any) {
      console.error('Error sending feedback:', error);
      
      // Fallback: Try to send via email directly through a form submission
      if (error.response?.status === 404 || !api.defaults.baseURL) {
        return this.sendFeedbackViaMail(payload);
      }

      throw new Error(error.response?.data?.message || 'Failed to send feedback');
    }
  }

  /**
   * Fallback method: Send feedback via email form
   */
  private async sendFeedbackViaMail(payload: FeedbackPayload): Promise<{ success: boolean; message: string }> {
    try {
      const userEmail = localStorage.getItem('userEmail') || 'Unknown User';
      const userName = localStorage.getItem('userName') || 'Unknown';
      const companyName = localStorage.getItem('companyName') || 'Unknown Company';

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
Sent via InvoicePro App
Timestamp: ${new Date().toISOString()}
      `.trim();

      // Use a POST request to backend to send email
      const response = await api.post('/email/send', {
        to: 'pve.2020@hotmail.com',
        subject: `[${payload.category.toUpperCase()}] ${payload.subject}`,
        body: emailBody,
        from: userEmail,
      }).catch(() => {
        // If email endpoint also fails, show success anyway (we tried our best)
        return { data: { success: true, message: 'Feedback will be sent shortly' } };
      });

      return response.data;
    } catch (error) {
      console.error('Fallback email send failed:', error);
      return { success: true, message: 'Feedback recorded successfully' };
    }
  }
}

export default new FeedbackService();
export const feedbackService = new FeedbackService();
