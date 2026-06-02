import { alpha, type SxProps, type Theme } from '@mui/material/styles';

/** Shared tokens for enterprise dashboard (light + dark-ready). */
export const DASHBOARD_THEME = {
  fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
  bg: '#F8FAFC',
  bgSubtle: '#F1F5F9',
  primary: '#2563EB',
  primarySoft: '#EFF6FF',
  cardRadius: '16px',
  innerRadius: '12px',
  /** Layered soft shadow — premium desktop ERP */
  cardShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
  cardShadowHover: '0 12px 32px rgba(15, 23, 42, 0.12)',
  glassShadow: '0 1px 3px rgba(37, 99, 235, 0.08), 0 8px 24px rgba(15, 23, 42, 0.08)',
  hoverLift: 'translateY(-4px)',
  transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
  padDesktop: 3,
  padTablet: 2,
  gridGap: 2,
  text: {
    primary: '#0F172A',
    secondary: '#64748B',
    muted: '#94A3B8',
  },
  border: 'rgba(15, 23, 42, 0.06)',
  borderMedium: 'rgba(15, 23, 42, 0.08)',
  kpi: {
    sales: '#2563EB',
    receipts: '#16A34A',
    outstanding: '#F59E0B',
    stock: '#7C3AED',
  },
  status: {
    ok: '#22C55E',
    warn: '#F59E0B',
    error: '#EF4444',
  },
  aging: ['#22C55E', '#F59E0B', '#FB923C', '#EF4444'],
} as const;

export const sectionTitleSx: SxProps<Theme> = {
  fontFamily: DASHBOARD_THEME.fontFamily,
  fontSize: '0.9375rem',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: DASHBOARD_THEME.text.primary,
  lineHeight: 1.3,
};

export const sectionEyebrowSx: SxProps<Theme> = {
  fontFamily: DASHBOARD_THEME.fontFamily,
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: DASHBOARD_THEME.text.muted,
};

export function dashboardCardSx(isDark: boolean, accent?: string) {
  return {
    fontFamily: DASHBOARD_THEME.fontFamily,
    borderRadius: DASHBOARD_THEME.cardRadius,
    border: '1px solid',
    borderColor: accent
      ? alpha(accent, isDark ? 0.28 : 0.12)
      : isDark
        ? alpha('#fff', 0.08)
        : DASHBOARD_THEME.border,
    bgcolor: isDark ? alpha('#1E293B', 0.65) : '#FFFFFF',
    boxShadow: isDark ? 'none' : DASHBOARD_THEME.cardShadow,
    transition: DASHBOARD_THEME.transition,
    overflow: 'hidden',
  };
}

export function glassDateCardSx(isDark: boolean): SxProps<Theme> {
  return {
    px: 1.5,
    py: 0.875,
    borderRadius: DASHBOARD_THEME.cardRadius,
    border: '1px solid',
    borderColor: isDark
      ? alpha(DASHBOARD_THEME.primary, 0.35)
      : alpha(DASHBOARD_THEME.primary, 0.12),
    background: isDark
      ? `linear-gradient(135deg, ${alpha('#1E293B', 0.9)} 0%, ${alpha('#334155', 0.75)} 100%)`
      : `linear-gradient(135deg, ${alpha('#FFFFFF', 0.95)} 0%, ${alpha(DASHBOARD_THEME.primarySoft, 0.65)} 100%)`,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: isDark ? 'none' : DASHBOARD_THEME.glassShadow,
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
