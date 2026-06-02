export type WhatsAppConnectionMode = 'desktop' | 'web' | 'none';

export interface WhatsAppConnectionStatus {
  ok: boolean;
  status: string;
  mode: WhatsAppConnectionMode;
}

const DEFAULT_STATUS: WhatsAppConnectionStatus = {
  ok: false,
  status: 'Checking…',
  mode: 'none',
};

let cachedStatus: WhatsAppConnectionStatus = { ...DEFAULT_STATUS };
const listeners = new Set<(status: WhatsAppConnectionStatus) => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn(cachedStatus));
}

function setCachedStatus(next: WhatsAppConnectionStatus) {
  cachedStatus = next;
  notifyListeners();
}

export function subscribeWhatsAppConnectionStatus(
  listener: (status: WhatsAppConnectionStatus) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function phoneToWhatsAppUrl(phone: string, message: string): string {
  const digits = String(phone).replace(/\D/g, '');
  const intl = digits.length === 10 ? `91${digits}` : digits;
  if (!intl) return `https://wa.me/?text=${encodeURIComponent(message)}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

/** Synchronous read of last known status (refresh on mount via refreshWhatsAppConnectionStatus). */
export function getWhatsAppConnectionStatus(): WhatsAppConnectionStatus {
  return cachedStatus;
}

/** Passive check: desktop installed, or prior successful web launch this session. */
export async function refreshWhatsAppConnectionStatus(): Promise<WhatsAppConnectionStatus> {
  try {
    const api = window.electronAPI;
    if (api?.whatsappCheckStatus) {
      const result = await api.whatsappCheckStatus();
      const next: WhatsAppConnectionStatus = {
        ok: Boolean(result?.ok),
        status: String(result?.status || (result?.ok ? 'Connected' : 'Not connected')),
        mode: (result?.mode as WhatsAppConnectionMode) || (result?.ok ? 'desktop' : 'none'),
      };
      setCachedStatus(next);
      return next;
    }
  } catch {
    // fall through
  }

  const fallback: WhatsAppConnectionStatus = {
    ok: false,
    status: 'Not connected',
    mode: 'none',
  };
  setCachedStatus(fallback);
  return fallback;
}

export interface OpenWhatsAppChatResult {
  ok: boolean;
  mode: WhatsAppConnectionMode;
  status: string;
  error?: string;
}

async function openUrlInElectron(url: string): Promise<boolean> {
  const api = window.electronAPI;
  if (!api?.openExternalUrl) return false;
  try {
    return Boolean(await api.openExternalUrl(url));
  } catch {
    return false;
  }
}

/**
 * Opens WhatsApp with pre-filled message. Does not auto-send — user confirms in WhatsApp.
 */
export async function openWhatsAppChat(phone: string, message: string): Promise<OpenWhatsAppChatResult> {
  const trimmedPhone = String(phone || '').trim();
  const trimmedMessage = String(message || '').trim();
  if (!trimmedPhone.replace(/\D/g, '')) {
    return { ok: false, mode: 'none', status: 'Not connected', error: 'Mobile number is required.' };
  }

  const api = window.electronAPI;
  const waUrl = phoneToWhatsAppUrl(trimmedPhone, trimmedMessage);

  if (api?.whatsappOpenChat) {
    try {
      const result = await api.whatsappOpenChat(trimmedPhone, trimmedMessage);
      if (result?.ok) {
        const next: WhatsAppConnectionStatus = {
          ok: true,
          status: String(result.status || 'Connected'),
          mode: (result.mode as WhatsAppConnectionMode) || 'desktop',
        };
        setCachedStatus(next);
        return {
          ok: true,
          mode: next.mode,
          status: next.status,
        };
      }
    } catch {
      // try wa.me via shell next
    }
  }

  if (api?.openExternalUrl) {
    const opened = await openUrlInElectron(waUrl);
    if (opened) {
      const next: WhatsAppConnectionStatus = { ok: true, status: 'Connected', mode: 'web' };
      setCachedStatus(next);
      return { ok: true, mode: 'web', status: next.status };
    }
    return {
      ok: false,
      mode: 'none',
      status: 'Not connected',
      error:
        'Could not open WhatsApp. Restart PVE InvoicePro once, then try again. Ensure WhatsApp Desktop is installed.',
    };
  }

  try {
    const popup = window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (!popup) {
      return {
        ok: false,
        mode: 'none',
        status: 'Not connected',
        error: 'Allow pop-ups in your browser to open WhatsApp Web.',
      };
    }
    setCachedStatus({ ok: true, status: 'Connected (Web)', mode: 'web' });
    return { ok: true, mode: 'web', status: 'Connected (Web)' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not open WhatsApp.';
    return { ok: false, mode: 'none', status: 'Not connected', error: msg };
  }
}
