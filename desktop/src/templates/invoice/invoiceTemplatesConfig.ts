import modernBlueHtml from './invoice-modern-blue.html?raw';
import cleanMinimalHtml from './invoice-clean-minimal.html?raw';
import navyGoldHtml from './invoice-navy-gold.html?raw';

export type InvoiceTemplateId = 'modern-blue' | 'clean-minimal' | 'navy-gold';

export type InvoiceTemplateDefinition = {
  id: InvoiceTemplateId;
  name: string;
  description: string;
  file: string;
  html: string;
  /** Thumbnail accent for selector UI */
  preview: {
    headerBg: string;
    accent: string;
    text: string;
  };
};

export const INVOICE_TEMPLATES: InvoiceTemplateDefinition[] = [
  {
    id: 'modern-blue',
    name: 'Modern Blue',
    description: 'Bold blue header with clean tax invoice layout',
    file: 'invoice-modern-blue.html',
    html: modernBlueHtml,
    preview: { headerBg: '#0C447C', accent: '#E6F1FB', text: '#0C447C' },
  },
  {
    id: 'clean-minimal',
    name: 'Clean Minimal',
    description: 'White space, black typography, minimal borders',
    file: 'invoice-clean-minimal.html',
    html: cleanMinimalHtml,
    preview: { headerBg: '#ffffff', accent: '#111827', text: '#111827' },
  },
  {
    id: 'navy-gold',
    name: 'Navy Gold',
    description: 'Matches PVE InvoicePro theme — navy & gold accents',
    file: 'invoice-navy-gold.html',
    html: navyGoldHtml,
    preview: { headerBg: '#1a2e4a', accent: '#EF9F27', text: '#ffffff' },
  },
];

export const DEFAULT_INVOICE_TEMPLATE_ID: InvoiceTemplateId = 'navy-gold';

export const getTemplateById = (id: string): InvoiceTemplateDefinition => {
  const found = INVOICE_TEMPLATES.find((t) => t.id === id);
  return found || INVOICE_TEMPLATES.find((t) => t.id === DEFAULT_INVOICE_TEMPLATE_ID)!;
};
