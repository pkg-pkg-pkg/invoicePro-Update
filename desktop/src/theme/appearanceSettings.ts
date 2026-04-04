export const APPEARANCE_CHANGED_EVENT = 'invoicepro-appearance-changed';

export const LS_UI_MODE = 'invoicepro_ui_mode';
export const LS_ACCENT_COLOR = 'invoicepro_accent_color';

export type UiMode = 'premium-dark' | 'light';

/** Matches InvoicePro user guide / brand green */
export const DEFAULT_ACCENT = '#0f5132';

export const ACCENT_PRESETS: { label: string; value: string }[] = [
  { label: 'InvoicePro green', value: '#0f5132' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Slate', value: '#475569' },
  { label: 'Amber', value: '#d97706' },
];

function normalizeHex(input: string): string | null {
  const s = input.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return null;
}

export function readUiMode(): UiMode {
  try {
    const v = localStorage.getItem(LS_UI_MODE);
    if (v === 'light' || v === 'premium-dark') return v;
  } catch {
    /* ignore */
  }
  return 'premium-dark';
}

export function readAccentColor(): string {
  try {
    const raw = localStorage.getItem(LS_ACCENT_COLOR);
    if (raw) {
      const n = normalizeHex(raw);
      if (n) return n;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ACCENT;
}

export function readAppearance(): { mode: UiMode; accent: string } {
  return { mode: readUiMode(), accent: readAccentColor() };
}

export function writeAppearance(mode: UiMode, accent: string): void {
  try {
    localStorage.setItem(LS_UI_MODE, mode);
    const n = normalizeHex(accent) ?? DEFAULT_ACCENT;
    localStorage.setItem(LS_ACCENT_COLOR, n);
  } catch {
    /* ignore */
  }
}

export function dispatchAppearanceChanged(): void {
  window.dispatchEvent(new Event(APPEARANCE_CHANGED_EVENT));
}

/** Persist and notify after localStorage flush (helps Electron/renderer sync). */
export function applyAppearanceAndNotify(mode: UiMode, accentInput: string): void {
  writeAppearance(mode, accentInput);
  queueMicrotask(() => {
    dispatchAppearanceChanged();
  });
}

export function isValidAccentHex(input: string): boolean {
  return normalizeHex(input) != null;
}
