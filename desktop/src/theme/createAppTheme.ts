import { createTheme, alpha, darken, lighten } from '@mui/material/styles';
import type { UiMode } from './appearanceSettings';
import { DEFAULT_ACCENT } from './appearanceSettings';
import { contrastRatioHex, contrastTextOnBackground, mixHex } from './colorUtils';

function normalizeAccent(hex: string): string {
  const s = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s}`;
  return DEFAULT_ACCENT;
}

const sharedTypography = {
  fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  h4: { fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 },
  h5: { fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.3 },
  h6: { fontWeight: 600, letterSpacing: '-0.01em' },
  body1: { letterSpacing: '-0.01em' },
  body2: { letterSpacing: '-0.01em' },
  button: { textTransform: 'none' as const, fontWeight: 600, letterSpacing: '-0.01em' },
  overline: { letterSpacing: '0.1em', fontWeight: 600 },
};

export function createAppTheme(opts: { mode: UiMode; accentMain: string }) {
  const accent = normalizeAccent(opts.accentMain);
  const isDark = opts.mode === 'premium-dark';

  if (isDark) {
    const defBg = '#0c0c0f';
    const sidebarBg = mixHex(defBg, accent, 0.14);
    const paper = mixHex(sidebarBg, '#ffffff', 0.045);
    const onBg = contrastTextOnBackground(defBg);
    const onPaper = contrastTextOnBackground(paper);
    const secondaryMain = lighten(accent, 0.1);
    const primaryContrast = contrastTextOnBackground(accent);
    const secondaryContrast = contrastTextOnBackground(secondaryMain);
    return createTheme({
      palette: {
        mode: 'dark',
        primary: {
          main: accent,
          light: lighten(accent, 0.15),
          dark: darken(accent, 0.2),
          contrastText: primaryContrast,
        },
        secondary: {
          main: secondaryMain,
          light: lighten(accent, 0.22),
          dark: darken(accent, 0.12),
          contrastText: secondaryContrast,
        },
        success: { main: '#2dd4bf', contrastText: contrastTextOnBackground('#2dd4bf') },
        error: { main: '#fb7185', contrastText: contrastTextOnBackground('#fb7185') },
        warning: { main: '#fbbf24', contrastText: contrastTextOnBackground('#fbbf24') },
        info: { main: '#38bdf8', contrastText: contrastTextOnBackground('#38bdf8') },
        background: { default: defBg, paper, content: defBg, sidebar: sidebarBg },
        text: {
          primary: onBg,
          secondary: alpha(onBg, 0.62),
          disabled: alpha(onBg, 0.38),
        },
        divider: alpha(onBg, 0.1),
      },
      typography: sharedTypography,
      shape: { borderRadius: 12 },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: { scrollbarColor: `${alpha(accent, 0.35)} ${alpha(onBg, 0.08)}` },
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
              padding: '8px 16px',
              boxShadow: 'none',
              '&:hover': { boxShadow: `0 4px 14px ${alpha(accent, 0.25)}` },
            },
            containedPrimary: {
              background: `linear-gradient(135deg, ${lighten(accent, 0.06)} 0%, ${darken(accent, 0.12)} 100%)`,
              color: primaryContrast,
              '&:hover': { color: primaryContrast },
            },
            containedSecondary: {
              color: secondaryContrast,
              '&:hover': { color: secondaryContrast },
            },
            outlinedPrimary: ({ theme }) => {
              const r = contrastRatioHex(theme.palette.primary.main, theme.palette.background.paper);
              if (r >= 3) return {};
              const c = theme.palette.primary.light;
              return {
                color: c,
                borderColor: alpha(c, 0.55),
                '&:hover': { borderColor: alpha(c, 0.75), color: c },
              };
            },
            textPrimary: ({ theme }) => {
              const r = contrastRatioHex(theme.palette.primary.main, theme.palette.background.paper);
              if (r >= 3) return {};
              return { color: theme.palette.primary.light };
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: 14,
              backgroundImage: 'none',
              boxShadow: `0 4px 24px ${alpha('#000', 0.45)}`,
              border: `1px solid ${alpha(onBg, 0.08)}`,
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              borderRadius: 14,
              backgroundImage: 'none',
              border: `1px solid ${alpha(onBg, 0.07)}`,
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
              '& fieldset': { borderColor: alpha(onPaper, 0.14) },
              '&:hover fieldset': { borderColor: alpha(onPaper, 0.22) },
            },
          },
        },
        MuiInputLabel: {
          styleOverrides: {
            root: ({ theme }) => ({
              color: theme.palette.text.secondary,
              '&.Mui-focused': { color: theme.palette.primary.light },
            }),
          },
        },
        MuiFormHelperText: {
          styleOverrides: {
            root: ({ theme }) => ({ color: theme.palette.text.secondary }),
          },
        },
      },
    });
  }

  const lightPaper = '#ffffff';
  const lightBg = '#f1f5f9';
  const sidebarLight = mixHex(lightPaper, accent, 0.07);
  const onLightBg = contrastTextOnBackground(lightBg);
  const secondaryMainLt = darken(accent, 0.08);
  const secondaryContrastLt = contrastTextOnBackground(secondaryMainLt);
  const accentBtnText = contrastTextOnBackground(accent);

  return createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: accent,
        light: lighten(accent, 0.12),
        dark: darken(accent, 0.15),
        contrastText: accentBtnText,
      },
      secondary: {
        main: secondaryMainLt,
        light: lighten(accent, 0.08),
        dark: darken(accent, 0.22),
        contrastText: secondaryContrastLt,
      },
      success: { main: '#10b981', contrastText: contrastTextOnBackground('#10b981') },
      error: { main: '#ef4444', contrastText: contrastTextOnBackground('#ef4444') },
      background: { default: lightBg, paper: lightPaper, content: lightBg, sidebar: sidebarLight },
      text: {
        primary: onLightBg,
        secondary: alpha(onLightBg, 0.58),
        disabled: alpha(onLightBg, 0.38),
      },
    },
    typography: sharedTypography,
    shape: { borderRadius: 12 },
    components: {
      MuiLink: {
        defaultProps: { underline: 'hover' },
        styleOverrides: {
          root: ({ theme }) => {
            const r = contrastRatioHex(theme.palette.primary.main, theme.palette.background.paper);
            return r < 3 ? { color: theme.palette.primary.dark } : {};
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 16px',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${lighten(accent, 0.08)} 0%, ${darken(accent, 0.12)} 100%)`,
            color: accentBtnText,
            '&:hover': { color: accentBtnText },
          },
          containedSecondary: {
            color: secondaryContrastLt,
            '&:hover': { color: secondaryContrastLt },
          },
          outlinedPrimary: ({ theme }) => {
            const r = contrastRatioHex(theme.palette.primary.main, theme.palette.background.paper);
            if (r >= 3) return {};
            return {
              color: theme.palette.primary.dark,
              borderColor: alpha(theme.palette.primary.dark, 0.45),
              '&:hover': {
                borderColor: theme.palette.primary.dark,
                color: theme.palette.primary.dark,
              },
            };
          },
          textPrimary: ({ theme }) => {
            const r = contrastRatioHex(theme.palette.primary.main, theme.palette.background.paper);
            if (r >= 3) return {};
            return { color: theme.palette.primary.dark };
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
            border: '1px solid #e2e8f0',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { borderRadius: 16 },
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
            '& fieldset': { borderColor: alpha(onLightBg, 0.22) },
            '&:hover fieldset': { borderColor: alpha(onLightBg, 0.35) },
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
      MuiFormHelperText: {
        styleOverrides: {
          root: ({ theme }) => ({ color: theme.palette.text.secondary }),
        },
      },
    },
  });
}
