/**
 * PVE InvoicePro 360 — Light theme tokens (White + Navy + Gold).
 * Used by createAppTheme and CSS variable sync.
 */
export const LIGHT_THEME = {
  mode: 'light' as const,

  background: {
    default: '#F8FAFC',
    paper: '#FFFFFF',
    content: '#F8FAFC',
    header: '#FFFFFF',
    sidebar: '#0F172A',
    elevated: '#F1F5F9',
    card: '#FFFFFF',
  },

  text: {
    primary: '#0F172A',
    secondary: '#64748B',
    muted: '#94A3B8',
  },

  border: '#E2E8F0',

  primary: '#2563EB',
  primarySoft: '#EFF6FF',
  gold: '#F59E0B',
  goldSoft: '#FFFBEB',

  success: '#16A34A',
  warning: '#EA580C',
  error: '#DC2626',
  info: '#2563EB',

  cardShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
  cardShadowHover: '0 8px 24px rgba(37, 99, 235, 0.1), 0 2px 8px rgba(15, 23, 42, 0.06)',

  search: {
    bg: '#FFFFFF',
    border: '#E2E8F0',
    borderFocus: '#2563EB',
  },

  assistantGradient: 'linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)',
  transition: 'background-color 300ms ease, color 300ms ease, border-color 300ms ease, box-shadow 300ms ease',
} as const;

export type LightThemeTokens = typeof LIGHT_THEME;
