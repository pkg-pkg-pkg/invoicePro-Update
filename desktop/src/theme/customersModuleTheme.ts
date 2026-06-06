import { alpha, type Theme } from '@mui/material/styles';
import { LIGHT_THEME } from './lightTheme';
import { DARK_THEME } from './darkTheme';

export const CUSTOMERS_MODULE = {
  navy: '#0B1F3A',
  navyMid: '#132D54',
  gold: '#C9A227',
  accent: '#2563EB',
  listActive: '#EFF6FF',
  listActiveBorder: '#2563EB',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  border: '#E2E8F0',
  radius: 10,
} as const;

export function getCustomersModuleTokens(theme: Theme) {
  const isDark = theme.palette.mode === 'dark';
  const base = isDark ? DARK_THEME : LIGHT_THEME;
  return {
    isDark,
    navy: isDark ? '#0B1220' : CUSTOMERS_MODULE.navy,
    navyMid: isDark ? '#111827' : CUSTOMERS_MODULE.navyMid,
    gold: isDark ? DARK_THEME.gold : CUSTOMERS_MODULE.gold,
    accent: CUSTOMERS_MODULE.accent,
    listActive: isDark ? alpha(CUSTOMERS_MODULE.accent, 0.15) : CUSTOMERS_MODULE.listActive,
    listActiveBorder: CUSTOMERS_MODULE.listActiveBorder,
    surface: isDark ? base.background.card : CUSTOMERS_MODULE.surface,
    surfaceMuted: isDark ? alpha('#263445', 0.6) : CUSTOMERS_MODULE.surfaceMuted,
    border: isDark ? base.border : CUSTOMERS_MODULE.border,
    text: isDark ? base.text.primary : '#0F172A',
    textMuted: isDark ? base.text.secondary : '#64748B',
    radius: CUSTOMERS_MODULE.radius,
  };
}

export type CustomersModuleTokens = ReturnType<typeof getCustomersModuleTokens>;
