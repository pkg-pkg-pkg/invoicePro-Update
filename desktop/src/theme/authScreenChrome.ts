import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

/** Hero strip behind Company Identity on Settings (Company tab). */
export function settingsIdentityHeroGradient(theme: Theme): string {
  const p = theme.palette.primary;
  return `linear-gradient(135deg, ${p.dark} 0%, ${p.main} 55%, ${p.light} 110%)`;
}

/** Base Paper styles for auth / splash cards (merged with screen-specific sx). */
export function authPaperSx(theme: Theme) {
  return {
    color: theme.palette.text.primary,
    border: `1px solid ${alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.12 : 0.35)}`,
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 18px 50px rgba(0,0,0,0.45)'
        : '0 18px 50px rgba(15, 23, 42, 0.12)',
    backdropFilter: 'blur(12px)',
  } as const;
}
