import { createTheme, alpha, darken, lighten } from '@mui/material/styles';
import type { UiMode } from './appearanceSettings';
import { DEFAULT_ACCENT } from './appearanceSettings';
import { contrastRatioHex, contrastTextOnBackground } from './colorUtils';
import { LIGHT_THEME } from './lightTheme';
import { DARK_THEME } from './darkTheme';

function normalizeAccent(hex: string): string {
  const s = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s}`;
  return DEFAULT_ACCENT;
}

const sharedTypography = {
  fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  h4: { fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, fontSize: '1.65rem' },
  h5: { fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.25, fontSize: '1.3rem' },
  h6: { fontWeight: 600, letterSpacing: '-0.01em', fontSize: '1.05rem' },
  body1: { letterSpacing: '-0.005em', fontSize: '0.94rem' },
  body2: { letterSpacing: '-0.005em', fontSize: '0.86rem' },
  button: { textTransform: 'none' as const, fontWeight: 600, letterSpacing: '-0.01em' },
  overline: { letterSpacing: '0.1em', fontWeight: 600 },
};

const TRANSITION = 'background-color 300ms ease, color 300ms ease, border-color 300ms ease, box-shadow 300ms ease';

export function createAppTheme(opts: { mode: UiMode; accentMain: string }) {
  const accent = normalizeAccent(opts.accentMain);
  const isDark = opts.mode === 'premium-dark';
  const tokens = isDark ? DARK_THEME : LIGHT_THEME;
  const primaryMain = isDark ? tokens.primary : accent;
  const onBg = tokens.text.primary;
  const onPaper = tokens.text.primary;
  const defBg = tokens.background.default;
  const paper = tokens.background.paper;
  const primaryContrast = contrastTextOnBackground(primaryMain);
  const secondaryMain = isDark ? lighten(primaryMain, 0.08) : darken(accent, 0.04);
  const secondaryContrast = contrastTextOnBackground(secondaryMain);

  return createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: {
        main: primaryMain,
        light: lighten(primaryMain, 0.15),
        dark: darken(primaryMain, 0.15),
        contrastText: primaryContrast,
      },
      secondary: {
        main: secondaryMain,
        light: lighten(primaryMain, 0.22),
        dark: darken(primaryMain, 0.12),
        contrastText: secondaryContrast,
      },
      success: { main: tokens.success, contrastText: contrastTextOnBackground(tokens.success) },
      error: { main: tokens.error, contrastText: contrastTextOnBackground(tokens.error) },
      warning: { main: tokens.warning, contrastText: contrastTextOnBackground(tokens.warning) },
      info: { main: tokens.info, contrastText: contrastTextOnBackground(tokens.info) },
      background: {
        default: defBg,
        paper,
        content: tokens.background.content,
        sidebar: tokens.background.sidebar,
        header: tokens.background.header,
        elevated: tokens.background.elevated,
        card: 'card' in tokens.background ? tokens.background.card : paper,
      },
      text: {
        primary: tokens.text.primary,
        secondary: tokens.text.secondary,
        disabled: alpha(tokens.text.primary, 0.38),
      },
      divider: tokens.border,
      gold: { main: tokens.gold, contrastText: contrastTextOnBackground(tokens.gold) },
    },
    typography: sharedTypography,
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { transition: TRANSITION },
          body: {
            scrollbarColor: isDark
              ? `${alpha(primaryMain, 0.35)} ${alpha(tokens.text.primary, 0.08)}`
              : `${alpha(primaryMain, 0.25)} ${alpha(tokens.text.primary, 0.06)}`,
            backgroundColor: 'var(--bg-main)',
            color: 'var(--text-primary)',
            transition: TRANSITION,
          },
        },
      },
      MuiLink: {
        defaultProps: { underline: 'hover' },
        styleOverrides: {
          root: ({ theme }) => {
            const r = contrastRatioHex(theme.palette.primary.main, theme.palette.background.default);
            return r < 3 ? { color: theme.palette.primary.light } : {};
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '6px 12px',
            boxShadow: 'none',
            transition: TRANSITION,
            '&:hover': {
              boxShadow: isDark
                ? 'none'
                : '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            },
          },
          containedPrimary: {
            background: isDark ? primaryMain : `linear-gradient(135deg, ${lighten(primaryMain, 0.03)} 0%, ${darken(primaryMain, 0.06)} 100%)`,
            boxShadow: 'none',
            color: primaryContrast,
            '&:hover': { background: isDark ? lighten(primaryMain, 0.06) : undefined, boxShadow: 'none', color: primaryContrast },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundImage: 'none',
            bgcolor: paper,
            boxShadow: tokens.cardShadow,
            border: `1px solid ${tokens.border}`,
            transition: TRANSITION,
            ...(isDark
              ? {
                  '&:hover': { boxShadow: tokens.cardShadowHover, borderColor: tokens.border },
                }
              : {}),
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundImage: 'none',
            border: `1px solid ${tokens.border}`,
            boxShadow: tokens.cardShadow,
            backgroundColor: paper,
            transition: TRANSITION,
            ...(isDark
              ? {
                  '&:hover': { boxShadow: tokens.cardShadowHover, borderColor: tokens.border },
                }
              : {}),
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            bgcolor: paper,
            border: `1px solid ${tokens.border}`,
            boxShadow: isDark ? tokens.cardShadowHover : tokens.cardShadowHover,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            bgcolor: paper,
            border: `1px solid ${tokens.border}`,
            boxShadow: tokens.cardShadowHover,
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            bgcolor: paper,
            border: `1px solid ${tokens.border}`,
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? tokens.background.card : paper,
            border: `1px solid ${tokens.border}`,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            color: onBg,
            borderBottom: `1px solid ${tokens.border}`,
          },
          head: {
            color: tokens.text.secondary,
            backgroundColor: isDark ? tokens.background.elevated : tokens.background.elevated,
            fontWeight: 700,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: TRANSITION,
            '&:nth-of-type(even)': {
              backgroundColor: isDark ? alpha('#000', 0.12) : alpha(primaryMain, 0.02),
            },
            '&:hover': {
              backgroundColor: isDark ? alpha('#fff', 0.03) : alpha(primaryMain, 0.04),
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            color: onBg,
            borderColor: tokens.border,
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
        styleOverrides: {
          root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            color: onBg,
            bgcolor: isDark ? tokens.background.elevated : alpha(paper, 0.96),
            transition: TRANSITION,
            '& fieldset': { borderColor: tokens.border },
            '&:hover fieldset': { borderColor: alpha(primaryMain, 0.45) },
            '&.Mui-focused fieldset': { borderColor: primaryMain },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          input: {
            color: onBg,
            '&::placeholder': {
              color: tokens.text.muted,
              opacity: 1,
            },
            '&:-webkit-autofill': {
              WebkitBoxShadow: `0 0 0 100px ${isDark ? paper : '#ffffff'} inset`,
              WebkitTextFillColor: onBg,
              transition: 'background-color 9999s ease-out 0s',
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.secondary,
            '&.Mui-focused': { color: theme.palette.primary.main },
          }),
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            bgcolor: tokens.background.header,
            color: onBg,
            boxShadow: 'none',
            borderBottom: `1px solid ${tokens.border}`,
          },
        },
      },
    },
  });
}
