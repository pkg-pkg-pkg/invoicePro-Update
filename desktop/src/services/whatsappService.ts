// src/services/whatsappService.ts
import { openExternalUrl } from './printService';

export interface WhatsAppSettings {
  apiKey: string;
  phoneNumber: string;
  isEnabled: boolean;
}

export interface WhatsAppMessage {
  to: string;
  message: string;
  type?: 'text' | 'template';
}

export interface InvoiceMessageData {
  invoiceNumber: string;
  customerName: string;
  amount: number;
  dueDate: string;
  companyName: string;
}

export class WhatsAppService {
  private static instance: WhatsAppService;
  private settings: WhatsAppSettings | null = null;

  private constructor() {}

  static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  // Initialize WhatsApp settings
  initialize(settings: WhatsAppSettings) {
    this.settings = settings;
  }

  // Load settings from localStorage
  loadSettings(): WhatsAppSettings | null {
    try {
      const saved = localStorage.getItem('whatsapp-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.settings = settings;
        return settings;
      }
    } catch (error) {
      console.error('Error loading WhatsApp settings:', error);
    }
    return null;
  }

  // Save settings to localStorage
  saveSettings(settings: WhatsAppSettings) {
    try {
      localStorage.setItem('whatsapp-settings', JSON.stringify(settings));
      this.settings = settings;
    } catch (error) {
      console.error('Error saving WhatsApp settings:', error);
    }
  }

  // Check if WhatsApp is configured and enabled
  isConfigured(): boolean {
    return !!(this.settings?.isEnabled && this.settings?.apiKey && this.settings?.phoneNumber);
  }

  /** Desktop flow: open wa.me with pre-filled text (works without Business API). */
  async openWebChat(customerPhone: string, message: string): Promise<void> {
    const digits = String(customerPhone).replace(/\D/g, '');
    const intl = digits.length === 10 ? `91${digits}` : digits;
    const url = intl
      ? `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    await openExternalUrl(url);
  }

  // Send invoice message
  async sendInvoiceMessage(data: InvoiceMessageData, customerPhone: string): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp is not configured');
    }

    // Simulate API call - In production, integrate with WhatsApp Business API
    console.log('Sending WhatsApp invoice message:', {
      to: customerPhone,
      message: this.formatInvoiceMessage(data),
    });

    // Simulate successful send
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 1000);
    });
  }

  // Send outstanding reminder
  async sendOutstandingReminder(customerName: string, amount: number, dueDate: string, customerPhone: string): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp is not configured');
    }

    // Simulate API call - In production, integrate with WhatsApp Business API
    console.log('Sending WhatsApp reminder:', {
      to: customerPhone,
      message: this.formatReminderMessage(customerName, amount, dueDate),
    });

    // Simulate successful send
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 1000);
    });
  }

  // Format invoice message
  private formatInvoiceMessage(data: InvoiceMessageData): string {
    return `Dear ${data.customerName},

Thank you for your business!

Invoice Details:
📄 Invoice No: ${data.invoiceNumber}
💰 Amount: ₹${data.amount.toLocaleString('en-IN')}
📅 Due Date: ${new Date(data.dueDate).toLocaleDateString('en-IN')}

Please make the payment before the due date.

Best regards,
${data.companyName}`;
  }

  // Format reminder message
  private formatReminderMessage(customerName: string, amount: number, dueDate: string): string {
    return `Dear ${customerName},

This is a friendly reminder about your outstanding payment.

💰 Outstanding Amount: ₹${amount.toLocaleString('en-IN')}
📅 Due Date: ${new Date(dueDate).toLocaleDateString('en-IN')}

Please make the payment at your earliest convenience.

Thank you for your attention to this matter.`;
  }

  // Test WhatsApp connection
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    // Simulate connection test - In production, test actual API connectivity
    console.log('Testing WhatsApp connection with settings:', {
      apiKey: this.settings!.apiKey.substring(0, 8) + '...',
      phoneNumber: this.settings!.phoneNumber,
    });

    // Simulate successful test
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 1500);
    });
  }
}

// Export singleton instance
export const whatsAppService = WhatsAppService.getInstance();
