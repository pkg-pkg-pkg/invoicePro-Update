import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

/** App bar + Electron title bar gradient from current primary accent. */
export function appBarGradient(theme: Theme): string {
  if (theme.palette.mode === 'light') {
    return 'linear-gradient(180deg, var(--bg-topbar) 0%, var(--bg-topbar) 100%)';
  }
  return 'linear-gradient(180deg, var(--bg-topbar) 0%, #1E293B 100%)';
}

export function appBarForeground(theme: Theme): string {
  return theme.palette.mode === 'dark' ? 'rgba(241,245,249,0.96)' : 'var(--text-primary)';
}

export function appBarMutedForeground(theme: Theme): string {
  return theme.palette.mode === 'dark' ? alpha('#e2e8f0', 0.74) : 'var(--text-secondary)';
}
