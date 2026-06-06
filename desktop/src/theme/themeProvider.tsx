import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createAppTheme } from './createAppTheme';
import {
  APPEARANCE_CHANGED_EVENT,
  applyAppearanceAndNotify,
  readAppearance,
  type UiMode,
} from './appearanceSettings';

export type ThemeMode = 'light' | 'dark';

function uiModeToThemeMode(mode: UiMode): ThemeMode {
  return mode === 'light' ? 'light' : 'dark';
}

function themeModeToUiMode(mode: ThemeMode): UiMode {
  return mode === 'light' ? 'light' : 'premium-dark';
}

export interface PveThemeContextValue {
  mode: ThemeMode;
  accent: string;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const PveThemeContext = createContext<PveThemeContextValue | null>(null);

export function usePveTheme(): PveThemeContextValue {
  const ctx = useContext(PveThemeContext);
  if (!ctx) {
    throw new Error('usePveTheme must be used within PveThemeProvider');
  }
  return ctx;
}

/** Safe hook — returns null outside provider (e.g. login screen). */
export function usePveThemeOptional(): PveThemeContextValue | null {
  return useContext(PveThemeContext);
}

export interface PveThemeProviderProps {
  children: ReactNode;
}

/**
 * Central theme provider: MUI ThemeProvider + localStorage persistence + 300ms CSS transitions.
 */
export function PveThemeProvider({ children }: PveThemeProviderProps) {
  const [appearance, setAppearance] = useState(readAppearance);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const onAppearance = () => {
      setAppearance(readAppearance());
      setRevision((n) => n + 1);
    };
    window.addEventListener(APPEARANCE_CHANGED_EVENT, onAppearance);
    return () => window.removeEventListener(APPEARANCE_CHANGED_EVENT, onAppearance);
  }, []);

  const mode = uiModeToThemeMode(appearance.mode);

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-theme', appearance.mode);
    document.documentElement.style.colorScheme = mode;
  }, [appearance.mode, mode]);

  const theme = useMemo(
    () => createAppTheme({ mode: appearance.mode, accentMain: appearance.accent }),
    [appearance.mode, appearance.accent, revision]
  );

  const setMode = useCallback(
    (next: ThemeMode) => {
      applyAppearanceAndNotify(themeModeToUiMode(next), appearance.accent);
    },
    [appearance.accent]
  );

  const toggleMode = useCallback(() => {
    setMode(mode === 'light' ? 'dark' : 'light');
  }, [mode, setMode]);

  const value = useMemo<PveThemeContextValue>(
    () => ({
      mode,
      accent: appearance.accent,
      isDark: mode === 'dark',
      setMode,
      toggleMode,
    }),
    [mode, appearance.accent, setMode, toggleMode]
  );

  return (
    <PveThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </PveThemeContext.Provider>
  );
}
