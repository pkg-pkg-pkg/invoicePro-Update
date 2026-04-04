import type { Theme } from '@mui/material/styles';
import { darken } from '@mui/material/styles';

/** App bar + Electron title bar gradient from current primary accent. */
export function appBarGradient(theme: Theme): string {
  const m = theme.palette.primary.main;
  const d = theme.palette.primary.dark;
  if (theme.palette.mode === 'dark') {
    return `linear-gradient(180deg, ${darken(m, 0.62)} 0%, ${darken(m, 0.4)} 50%, ${darken(d, 0.25)} 100%)`;
  }
  return `linear-gradient(180deg, ${d} 0%, ${m} 100%)`;
}

export function appBarForeground(theme: Theme): string {
  return theme.palette.mode === 'dark' ? 'rgba(241,245,249,0.96)' : theme.palette.primary.contrastText;
}

export function appBarMutedForeground(theme: Theme): string {
  return theme.palette.mode === 'dark' ? 'rgba(241,245,249,0.55)' : 'rgba(0,0,0,0.55)';
}
