/**
 * PVE InvoicePro 360 — Enterprise dark theme (modern enterprise UI).
 * Flat surfaces · low eye strain · no neon or glow.
 */
export const DARK_THEME = {
  mode: 'dark' as const,

  background: {
    /** Main workspace */
    default: '#111827',
    /** Secondary panels, inputs */
    paper: '#1F2937',
    content: '#111827',
    header: '#0F172A',
    sidebar: '#0B1220',
    elevated: '#1F2937',
    /** Primary card surface */
    card: '#263445',
  },

  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    muted: '#64748B',
  },

  border: '#334155',

  primary: '#2563EB',
  primarySoft: 'rgba(37, 99, 235, 0.08)',
  gold: '#D4A017',
  goldSoft: 'rgba(212, 160, 23, 0.1)',

  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',

  /** Soft elevation only — no colored glow */
  cardShadow: '0 1px 2px rgba(0, 0, 0, 0.24)',
  cardShadowHover: '0 2px 8px rgba(0, 0, 0, 0.28)',

  search: {
    bg: '#1F2937',
    border: '#334155',
    borderFocus: '#2563EB',
  },

  /** Flat business panel header — not a gradient */
  assistantHeaderBg: '#0F172A',
  transition: 'background-color 300ms ease, color 300ms ease, border-color 300ms ease',
} as const;

export type DarkThemeTokens = typeof DARK_THEME;
