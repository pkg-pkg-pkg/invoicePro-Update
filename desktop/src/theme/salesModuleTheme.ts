import { alpha, type Theme } from '@mui/material/styles';
import { LIGHT_THEME } from './lightTheme';
import { DARK_THEME } from './darkTheme';

/** PVE Sales module — Navy + Gold enterprise SaaS (not Zoho palette) */
export const SALES_MODULE = {
  navy: '#0B1F3A',
  navyMid: '#132D54',
  navySoft: '#1E3A5F',
  gold: '#C9A227',
  goldBright: '#E8B923',
  goldSoft: '#FEF9E7',
  accent: '#2563EB',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F7FB',
  border: '#D6DFEA',
  text: '#0F172A',
  textMuted: '#5C6B7A',
  headerGradient: 'linear-gradient(135deg, #0B1F3A 0%, #132D54 55%, #1E3A5F 100%)',
  goldGradient: 'linear-gradient(135deg, #B8860B 0%, #E8B923 100%)',
  radius: 12,
  radiusSm: 8,
} as const;

export function getSalesModuleTokens(theme: Theme) {
  const isDark = theme.palette.mode === 'dark';
  const base = isDark ? DARK_THEME : LIGHT_THEME;
  return {
    isDark,
    navy: isDark ? '#0B1220' : SALES_MODULE.navy,
    navyMid: isDark ? '#111827' : SALES_MODULE.navyMid,
    gold: isDark ? DARK_THEME.gold : SALES_MODULE.gold,
    goldBright: SALES_MODULE.goldBright,
    surface: isDark ? base.background.card : SALES_MODULE.surface,
    surfaceMuted: isDark ? alpha('#263445', 0.85) : SALES_MODULE.surfaceMuted,
    border: isDark ? base.border : SALES_MODULE.border,
    text: isDark ? base.text.primary : SALES_MODULE.text,
    textMuted: isDark ? base.text.secondary : SALES_MODULE.textMuted,
    headerGradient: isDark
      ? `linear-gradient(135deg, #0B1220 0%, #111827 100%)`
      : SALES_MODULE.headerGradient,
    goldGradient: SALES_MODULE.goldGradient,
    radius: SALES_MODULE.radius,
    radiusSm: SALES_MODULE.radiusSm,
    tableHeaderBg: isDark ? '#1F2937' : SALES_MODULE.navyMid,
    tableHeaderText: '#F8FAFC',
    rowHover: isDark ? alpha('#2563EB', 0.08) : alpha(SALES_MODULE.navy, 0.04),
    activeNavBg: isDark ? alpha('#C9A227', 0.14) : alpha(SALES_MODULE.gold, 0.12),
    activeNavBorder: isDark ? DARK_THEME.gold : SALES_MODULE.gold,
  };
}

export type SalesModuleTokens = ReturnType<typeof getSalesModuleTokens>;
