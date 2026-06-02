import type { CustomerSummary } from '../types/dashboard';
import { getNormalizedCompanyProfile } from '../utils/companyProfile';
import { ledgerAccountService } from './masters/ledgerAccountService';
import { partyService } from './masters/partyService';

export interface OutstandingReminderDraft {
  customerId: string;
  customerName: string;
  mobile: string;
  outstandingAmount: number;
  message: string;
}

export function buildOutstandingReminderMessage(
  customerName: string,
  amount: number,
  companyName: string
): string {
  return `Dear ${customerName},

This is a friendly reminder about your outstanding payment.

Outstanding amount: ₹${amount.toLocaleString('en-IN')}

Please arrange payment at your earliest convenience.

Thank you,
${companyName}`;
}

export async function resolvePartyPhone(ledgerId: string, ledgerName: string): Promise<string | null> {
  const parties = await partyService.list();
  const key = ledgerName.trim().toLowerCase();
  const party = parties.find(
    (p) =>
      p.ledgerId === ledgerId ||
      p.id === ledgerId ||
      p.name.trim().toLowerCase() === key
  );
  const fromParty = String(party?.whatsapp || party?.mobile || '').trim();
  if (fromParty) return fromParty;

  try {
    const ledgers = await ledgerAccountService.list({ includeInactive: true });
    const ledger = ledgers.find((l) => l.id === ledgerId);
    const fromLedger = String(ledger?.contactDetails?.phone || '').trim();
    if (fromLedger) return fromLedger;
  } catch {
    // ignore
  }

  return null;
}

/** Build reminder preview data for a customer (does not open WhatsApp). */
export async function prepareOutstandingReminder(
  customer: CustomerSummary
): Promise<OutstandingReminderDraft | null> {
  const phone = await resolvePartyPhone(customer.id, customer.name);
  if (!phone) return null;

  const company = getNormalizedCompanyProfile().name || 'PVE InvoicePro 360';
  const amount = Number(customer.currentBalance || 0);
  return {
    customerId: customer.id,
    customerName: customer.name,
    mobile: phone,
    outstandingAmount: amount,
    message: buildOutstandingReminderMessage(customer.name, amount, company),
  };
}

/** Top overdue customer from dashboard summary, if any. */
export function pickTopOutstandingCustomer(
  customers: CustomerSummary[] | undefined | null
): CustomerSummary | null {
  if (!customers?.length) return null;
  const withBalance = customers.filter((c) => Number(c.currentBalance) > 0);
  if (!withBalance.length) return null;
  return withBalance[0];
}
