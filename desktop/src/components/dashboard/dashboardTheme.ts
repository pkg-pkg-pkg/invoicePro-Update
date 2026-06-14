import { useMemo } from 'react';
import { alpha, useTheme, type SxProps, type Theme } from '@mui/material/styles';
import { LIGHT_THEME } from '../../theme/lightTheme';
import { DARK_THEME } from '../../theme/darkTheme';

export interface DashboardThemeTokens {
  fontFamily: string;
  bg: string;
  bgSubtle: string;
  surface: string;
  headerNavy: string;
  primary: string;
  secondary: string;
  primarySoft: string;
  primaryMuted: string;
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  cardRadius: string;
  innerRadius: string;
  cardShadow: string;
  cardShadowHover: string;
  hoverLift: string;
  transition: string;
  padDesktop: number;
  padTablet: number;
  gridGap: number;
  text: { primary: string; secondary: string; muted: string };
  border: string;
  borderLight: string;
  kpi: { sales: string; receipts: string; outstanding: string; stock: string };
  status: { ok: string; warn: string; error: string };
  aging: readonly string[];
  assistantGradient: string;
  assistantHeaderBg?: string;
  /** Enterprise dark: flat cards, no lift/glow */
  enterprise?: boolean;
  kpiMinHeight?: number;
}

const SHARED_LAYOUT = {
  fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
  cardRadius: '16px',
  innerRadius: '12px',
  hoverLift: 'translateY(-3px)',
  transition: 'background-color 300ms ease, color 300ms ease, border-color 300ms ease, box-shadow 300ms ease, transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
  padDesktop: 3,
  padTablet: 2,
  gridGap: 2,
  aging: ['#16A34A', '#F59E0B', '#EA580C', '#DC2626', '#991B1B'] as const,
  assistantGradient: 'linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)',
};

export const LIGHT_DASHBOARD: DashboardThemeTokens = {
  ...SHARED_LAYOUT,
  bg: LIGHT_THEME.background.content,
  bgSubtle: LIGHT_THEME.background.elevated,
  surface: LIGHT_THEME.background.paper,
  headerNavy: LIGHT_THEME.background.sidebar,
  primary: '#1E40AF',
  secondary: LIGHT_THEME.primary,
  primarySoft: LIGHT_THEME.primarySoft,
  primaryMuted: '#DBEAFE',
  accent: LIGHT_THEME.gold,
  accentSoft: LIGHT_THEME.goldSoft,
  success: LIGHT_THEME.success,
  warning: LIGHT_THEME.warning,
  danger: LIGHT_THEME.error,
  cardShadow: LIGHT_THEME.cardShadow,
  cardShadowHover: LIGHT_THEME.cardShadowHover,
  text: LIGHT_THEME.text,
  border: LIGHT_THEME.border,
  borderLight: 'rgba(226, 232, 240, 0.9)',
  kpi: {
    sales: '#1E40AF',
    receipts: LIGHT_THEME.success,
    outstanding: LIGHT_THEME.gold,
    stock: LIGHT_THEME.primary,
  },
  status: { ok: LIGHT_THEME.success, warn: LIGHT_THEME.warning, error: LIGHT_THEME.error },
};

export const DARK_DASHBOARD: DashboardThemeTokens = {
  ...SHARED_LAYOUT,
  enterprise: true,
  cardRadius: '12px',
  innerRadius: '8px',
  hoverLift: 'none',
  gridGap: 1.75,
  bg: DARK_THEME.background.default,
  bgSubtle: DARK_THEME.background.paper,
  surface: DARK_THEME.background.card,
  headerNavy: DARK_THEME.background.sidebar,
  primary: DARK_THEME.primary,
  secondary: DARK_THEME.primary,
  primarySoft: DARK_THEME.primarySoft,
  primaryMuted: 'rgba(37, 99, 235, 0.12)',
  accent: DARK_THEME.gold,
  accentSoft: DARK_THEME.goldSoft,
  success: DARK_THEME.success,
  warning: DARK_THEME.warning,
  danger: DARK_THEME.error,
  cardShadow: DARK_THEME.cardShadow,
  cardShadowHover: DARK_THEME.cardShadowHover,
  text: DARK_THEME.text,
  border: DARK_THEME.border,
  borderLight: DARK_THEME.border,
  kpi: {
    sales: '#2563EB',
    receipts: '#16A34A',
    outstanding: '#D4A017',
    stock: '#64748B',
  },
  status: { ok: DARK_THEME.success, warn: DARK_THEME.warning, error: DARK_THEME.error },
  aging: ['#16A34A', '#D4A017', '#D97706', '#DC2626'],
  assistantGradient: DARK_THEME.assistantHeaderBg,
  assistantHeaderBg: DARK_THEME.assistantHeaderBg,
  kpiMinHeight: 132,
};

/** @deprecated Use useDashboardTheme() for theme-aware tokens */
export const DASHBOARD_THEME = LIGHT_DASHBOARD;

export function getDashboardTheme(mode: 'light' | 'dark'): DashboardThemeTokens {
  return mode === 'dark' ? DARK_DASHBOARD : LIGHT_DASHBOARD;
}

export function useDashboardTheme(): DashboardThemeTokens {
  const theme = useTheme();
  return useMemo(() => getDashboardTheme(theme.palette.mode), [theme.palette.mode]);
}

export function sectionTitleSx(dt: DashboardThemeTokens): SxProps<Theme> {
  return {
    fontFamily: dt.fontFamily,
    fontSize: '0.9375rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: dt.text.primary,
    lineHeight: 1.3,
  };
}

export function sectionEyebrowSx(dt: DashboardThemeTokens): SxProps<Theme> {
  return {
    fontFamily: dt.fontFamily,
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: dt.text.muted,
  };
}

export function dashboardCardSx(dt: DashboardThemeTokens, accent?: string) {
  return {
    fontFamily: dt.fontFamily,
    borderRadius: dt.cardRadius,
    border: '1px solid',
    borderColor: accent ? alpha(accent, 0.14) : dt.border,
    bgcolor: dt.surface,
    boxShadow: dt.cardShadow,
    transition: dt.transition,
    overflow: 'hidden',
    ...(dt.enterprise
      ? { '&:hover': { borderColor: dt.border, boxShadow: dt.cardShadowHover } }
      : { '&:hover': { boxShadow: dt.cardShadowHover } }),
  };
}

export function welcomeCardSx(dt: DashboardThemeTokens): SxProps<Theme> {
  return {
    p: { xs: 2, sm: dt.enterprise ? 2 : 2.5 },
    mb: dt.enterprise ? 2 : 3,
    borderRadius: dt.cardRadius,
    border: `1px solid ${dt.border}`,
    bgcolor: dt.surface,
    boxShadow: dt.cardShadow,
    ...(dt.enterprise
      ? {}
      : { background: `linear-gradient(180deg, ${dt.surface} 0%, ${alpha(dt.primarySoft, 0.35)} 100%)` }),
    transition: dt.transition,
  };
}

export function glassDateCardSx(dt: DashboardThemeTokens): SxProps<Theme> {
  return {
    px: 2,
    py: 1.25,
    borderRadius: dt.innerRadius,
    border: `1px solid ${dt.border}`,
    bgcolor: dt.surface,
    boxShadow: dt.cardShadow,
    transition: dt.transition,
  };
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function financialYearLabel(date: Date = new Date()): string {
  const m = date.getMonth();
  const y = date.getFullYear();
  const start = m >= 3 ? y : y - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function computeSparkTrend(data: Array<{ value: number }>): {
  pct: number;
  up: boolean;
} {
  if (data.length < 2) return { pct: 0, up: true };
  const first = data[0]?.value ?? 0;
  const last = data[data.length - 1]?.value ?? 0;
  if (first === 0) return { pct: last > 0 ? 100 : 0, up: last >= first };
  const change = ((last - first) / Math.abs(first)) * 100;
  return { pct: Math.round(Math.abs(change)), up: change >= 0 };
}
