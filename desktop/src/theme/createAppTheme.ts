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
  h4: { fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, fontSize: '1.65rem' },
  h5: { fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.25, fontSize: '1.3rem' },
  h6: { fontWeight: 600, letterSpacing: '-0.01em', fontSize: '1.05rem' },
  body1: { letterSpacing: '-0.005em', fontSize: '0.94rem' },
  body2: { letterSpacing: '-0.005em', fontSize: '0.86rem' },
  button: { textTransform: 'none' as const, fontWeight: 600, letterSpacing: '-0.01em' },
  overline: { letterSpacing: '0.1em', fontWeight: 600 },
};

export function createAppTheme(opts: { mode: UiMode; accentMain: string }) {
  const accent = normalizeAccent(opts.accentMain);
  const isDark = opts.mode === 'premium-dark';

  if (isDark) {
    const defBgHex = '#0B1220';
    const paperHex = '#111827';
    const sidebarHex = '#0F172A';
    const contentHex = '#0F172A';
    /** MUI palette must be parseable hex/rgb — never CSS variables (see colorManipulator). */
    const defBg = defBgHex;
    const paper = paperHex;
    const sidebarBg = sidebarHex;
    const onBg = contrastTextOnBackground(defBgHex);
    const onPaper = contrastTextOnBackground(paperHex);
    const secondaryMain = lighten(accent, 0.04);
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
        success: { main: '#22c55e', contrastText: contrastTextOnBackground('#22c55e') },
        error: { main: '#ef4444', contrastText: contrastTextOnBackground('#ef4444') },
        warning: { main: '#eab308', contrastText: contrastTextOnBackground('#eab308') },
        info: { main: '#3b82f6', contrastText: contrastTextOnBackground('#3b82f6') },
        background: { default: defBg, paper, content: contentHex, sidebar: sidebarBg },
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
            body: {
              scrollbarColor: `${alpha(accent, 0.35)} ${alpha(onBg, 0.08)}`,
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              transition: 'all 0.2s ease',
            },
            '*': {
              transition: 'all 0.2s ease',
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
              '&:hover': { boxShadow: `0 4px 14px ${alpha(accent, 0.16)}` },
            },
            containedPrimary: {
              background: `linear-gradient(135deg, ${mixHex('#ffffff', accent, 0.08)} 0%, ${mixHex('#0f172a', accent, 0.1)} 100%)`,
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
              borderRadius: 12,
              backgroundImage: 'none',
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.05)',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              borderRadius: 12,
              backgroundImage: 'none',
              border: `1px solid ${alpha(onBg, 0.07)}`,
              backgroundColor: 'var(--bg-card)',
              transition: 'all 0.2s ease',
            },
          },
        },
        MuiTypography: {
          styleOverrides: {
            root: {
              color: onBg,
            },
          },
        },
        MuiTableContainer: {
          styleOverrides: {
            root: {
              backgroundColor: alpha('#0B1220', 0.24),
              border: `1px solid ${alpha(onBg, 0.1)}`,
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              color: onBg,
              borderBottom: `1px solid ${alpha(onBg, 0.1)}`,
            },
            head: {
              color: alpha(onBg, 0.9),
              backgroundColor: alpha(onBg, 0.04),
              fontWeight: 700,
            },
          },
        },
        MuiTablePagination: {
          styleOverrides: {
            root: {
              color: onBg,
            },
            selectIcon: {
              color: alpha(onBg, 0.82),
            },
            actions: {
              color: onBg,
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              color: onBg,
              borderColor: alpha(onBg, 0.22),
            },
            outlined: {
              borderColor: alpha(onBg, 0.28),
            },
          },
        },
        MuiTextField: {
          defaultProps: { variant: 'outlined', size: 'small' },
          styleOverrides: {
            root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } },
          },
        },
        MuiInputBase: {
          styleOverrides: {
            input: {
              color: onBg,
              '&::placeholder': {
                color: alpha(onBg, 0.56),
                opacity: 1,
              },
              '&:-webkit-autofill': {
                WebkitBoxShadow: `0 0 0 100px ${alpha(defBgHex, 0.88)} inset`,
                WebkitTextFillColor: onBg,
                transition: 'background-color 9999s ease-out 0s',
              },
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              color: onBg,
              backgroundColor: alpha(onBg, 0.02),
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

  const lightBg = '#F1F5F9';
  const lightPaperHex = '#FFFFFF';
  const lightContentHex = '#F8FAFC';
  const lightSidebarHex = '#FFFFFF';
  const onLightBg = contrastTextOnBackground(lightBg);
  const secondaryMainLt = darken(accent, 0.04);
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
      background: {
        default: lightBg,
        paper: lightPaperHex,
        content: lightContentHex,
        sidebar: lightSidebarHex,
      },
      text: {
        primary: onLightBg,
        secondary: alpha(onLightBg, 0.58),
        disabled: alpha(onLightBg, 0.38),
      },
    },
    typography: sharedTypography,
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: 'var(--bg-main)',
            color: 'var(--text-primary)',
            transition: 'all 0.2s ease',
          },
          '*': {
            transition: 'all 0.2s ease',
          },
        },
      },
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
            padding: '6px 12px',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${lighten(accent, 0.03)} 0%, ${darken(accent, 0.06)} 100%)`,
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
            borderRadius: 12,
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
            border: '1px solid #e2e8f0',
            backgroundColor: 'var(--bg-card)',
            transition: 'all 0.2s ease',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundImage: 'none',
            border: `1px solid ${alpha(onLightBg, 0.1)}`,
            boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
            backgroundColor: 'var(--bg-card)',
            transition: 'all 0.2s ease',
          },
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: {
            color: onLightBg,
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
              backgroundColor: 'var(--bg-card)',
            border: `1px solid ${alpha(onLightBg, 0.14)}`,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            color: onLightBg,
            borderBottom: `1px solid ${alpha(onLightBg, 0.12)}`,
          },
          head: {
            color: alpha(onLightBg, 0.88),
            backgroundColor: alpha(onLightBg, 0.04),
            fontWeight: 700,
          },
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          root: {
            color: onLightBg,
          },
          selectIcon: {
            color: alpha(onLightBg, 0.74),
          },
          actions: {
            color: onLightBg,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            color: onLightBg,
            borderColor: alpha(onLightBg, 0.2),
          },
          outlined: {
            borderColor: alpha(onLightBg, 0.24),
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
        styleOverrides: {
          root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          input: {
            color: onLightBg,
            '&::placeholder': {
              color: alpha(onLightBg, 0.56),
              opacity: 1,
            },
            '&:-webkit-autofill': {
              WebkitBoxShadow: '0 0 0 100px #ffffff inset',
              WebkitTextFillColor: onLightBg,
              transition: 'background-color 9999s ease-out 0s',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            color: onLightBg,
            backgroundColor: alpha('#ffffff', 0.96),
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
