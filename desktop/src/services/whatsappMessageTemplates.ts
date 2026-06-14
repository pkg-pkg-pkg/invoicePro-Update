const STORAGE_KEY = 'pve_whatsapp_message_templates_v1';

export type WhatsAppTemplateKind = 'invoice' | 'paymentReminder' | 'outstanding';

export interface WhatsAppMessageTemplates {
  invoice: string;
  paymentReminder: string;
  outstanding: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppMessageTemplates = {
  invoice: `Dear {{customerName}},

Please find your {{documentType}} details:

📄 {{documentType}} No: {{invoiceNumber}}
📅 Date: {{invoiceDate}}
💰 Amount: ₹{{amount}}
{{#if paymentLink}}🔗 Pay online: {{paymentLink}}
{{/if}}{{#if pdfNote}}📎 {{pdfNote}}
{{/if}}{{#if outstandingAmount}}📊 Outstanding balance: ₹{{outstandingAmount}}
{{/if}}
Thank you for your business!

{{companyName}}`,
  paymentReminder: `Dear {{customerName}},

This is a friendly reminder about your outstanding payment.

💰 Outstanding amount: ₹{{outstandingAmount}}
📅 Due date: {{dueDate}}

Please arrange payment at your earliest convenience.

{{companyName}}`,
  outstanding: `Dear {{customerName}},

Your outstanding balance is ₹{{outstandingAmount}}.

Please contact us if you need a statement or payment link.

{{companyName}}`,
};

const PLACEHOLDER_RE = /\{\{(\/?if\s+\w+|\/if|\w+)\}\}/g;

function parseCondition(token: string): { type: 'if' | 'endif' | 'var'; name?: string } {
  if (token.startsWith('/if')) return { type: 'endif' };
  if (token.startsWith('if ')) return { type: 'if', name: token.slice(3).trim() };
  return { type: 'var', name: token };
}

/** Lightweight {{var}} and {{#if var}}...{{/if}} renderer for WhatsApp templates. */
export function renderWhatsAppTemplate(
  template: string,
  vars: Record<string, string | number | undefined | null>
): string {
  const normalized = Object.fromEntries(
    Object.entries(vars).map(([k, v]) => [k, v == null ? '' : String(v).trim()])
  );

  const renderBlock = (text: string): string => {
    let out = '';
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{{', i);
      if (open < 0) {
        out += text.slice(i);
        break;
      }
      out += text.slice(i, open);
      const close = text.indexOf('}}', open + 2);
      if (close < 0) {
        out += text.slice(open);
        break;
      }
      const token = text.slice(open + 2, close);
      const parsed = parseCondition(token);
      if (parsed.type === 'if' && parsed.name) {
        const endTag = `{{/if}}`;
        const endIdx = text.indexOf(endTag, close + 2);
        if (endIdx < 0) {
          i = close + 2;
          continue;
        }
        const inner = text.slice(close + 2, endIdx);
        if (normalized[parsed.name]) {
          out += renderBlock(inner);
        }
        i = endIdx + endTag.length;
        continue;
      }
      if (parsed.type === 'var' && parsed.name) {
        out += normalized[parsed.name] ?? '';
      }
      i = close + 2;
    }
    return out;
  };

  return renderBlock(template)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function loadWhatsAppMessageTemplates(): WhatsAppMessageTemplates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WHATSAPP_TEMPLATES };
    const parsed = JSON.parse(raw) as Partial<WhatsAppMessageTemplates>;
    return {
      invoice: String(parsed.invoice || DEFAULT_WHATSAPP_TEMPLATES.invoice),
      paymentReminder: String(parsed.paymentReminder || DEFAULT_WHATSAPP_TEMPLATES.paymentReminder),
      outstanding: String(parsed.outstanding || DEFAULT_WHATSAPP_TEMPLATES.outstanding),
    };
  } catch {
    return { ...DEFAULT_WHATSAPP_TEMPLATES };
  }
}

export function saveWhatsAppMessageTemplates(templates: WhatsAppMessageTemplates): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function getWhatsAppTemplate(kind: WhatsAppTemplateKind): string {
  return loadWhatsAppMessageTemplates()[kind];
}
