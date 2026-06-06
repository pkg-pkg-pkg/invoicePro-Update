import { alpha, type Theme } from '@mui/material/styles';
import { LIGHT_THEME } from './lightTheme';
import { DARK_THEME } from './darkTheme';

export const ITEMS_MODULE = {
  navy: '#0B1F3A',
  navyMid: '#132D54',
  gold: '#C9A227',
  goldBright: '#E8B923',
  accent: '#2563EB',
  listActive: '#EFF6FF',
  listActiveBorder: '#2563EB',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  border: '#E2E8F0',
  radius: 10,
} as const;

export function getItemsModuleTokens(theme: Theme) {
  const isDark = theme.palette.mode === 'dark';
  const base = isDark ? DARK_THEME : LIGHT_THEME;
  return {
    isDark,
    navy: isDark ? '#0B1220' : ITEMS_MODULE.navy,
    navyMid: isDark ? '#111827' : ITEMS_MODULE.navyMid,
    gold: isDark ? DARK_THEME.gold : ITEMS_MODULE.gold,
    accent: ITEMS_MODULE.accent,
    listActive: isDark ? alpha(ITEMS_MODULE.accent, 0.15) : ITEMS_MODULE.listActive,
    listActiveBorder: ITEMS_MODULE.listActiveBorder,
    surface: isDark ? base.background.card : ITEMS_MODULE.surface,
    surfaceMuted: isDark ? alpha('#263445', 0.6) : ITEMS_MODULE.surfaceMuted,
    border: isDark ? base.border : ITEMS_MODULE.border,
    text: isDark ? base.text.primary : '#0F172A',
    textMuted: isDark ? base.text.secondary : '#64748B',
    radius: ITEMS_MODULE.radius,
  };
}

export type ItemsModuleTokens = ReturnType<typeof getItemsModuleTokens>;
