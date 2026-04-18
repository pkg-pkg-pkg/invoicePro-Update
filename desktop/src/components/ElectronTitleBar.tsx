import { useEffect, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { appBarGradient, appBarForeground, appBarMutedForeground } from '../theme/shellChrome';
import RemoveIcon from '@mui/icons-material/Remove';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import FilterNoneIcon from '@mui/icons-material/FilterNone';
import CloseIcon from '@mui/icons-material/Close';
import { isElectronRuntime } from '../utils/runtime';
import { APP_DISPLAY_NAME, APP_TAGLINE } from '../constants/appBranding';

export const ELECTRON_TITLEBAR_HEIGHT_PX = 40;

/** True when Electron uses frameless window + custom title bar (Windows / Linux). */
export function electronUsesFramelessChrome(): boolean {
  if (!isElectronRuntime()) return false;
  const p = window.electronAPI?.electronPlatform;
  if (p === 'win32' || p === 'linux') return true;
  return false;
}

const dragSx = { WebkitAppRegion: 'drag' as const };
const noDragSx = { WebkitAppRegion: 'no-drag' as const };

/**
 * Frameless window chrome (Windows/Linux). Hidden in browser / Tauri.
 */
export default function ElectronTitleBar() {
  const theme = useTheme();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!electronUsesFramelessChrome()) return undefined;
    const api = window.electronAPI;
    void api.windowIsMaximized?.().then(setMaximized);
    const unsub = api.onWindowStateChanged?.(setMaximized);
    return () => {
      unsub?.();
    };
  }, []);

  if (!electronUsesFramelessChrome()) return null;

  const api = window.electronAPI;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: ELECTRON_TITLEBAR_HEIGHT_PX,
        zIndex: theme.zIndex.drawer + 2,
        display: 'flex',
        alignItems: 'center',
        px: 1,
        gap: 1,
        background: appBarGradient(theme),
        borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
        color: appBarForeground(theme),
        ...dragSx,
      }}
    >
      <Typography
        variant="body2"
        sx={{
          ml: 0.5,
          fontWeight: 800,
          color: 'inherit',
          fontSize: '0.8rem',
          letterSpacing: '-0.02em',
          userSelect: 'none',
          ...dragSx,
        }}
      >
        {APP_DISPLAY_NAME}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: appBarMutedForeground(theme),
          fontSize: '0.7rem',
          userSelect: 'none',
          display: { xs: 'none', sm: 'block' },
          ...dragSx,
        }}
      >
        {APP_TAGLINE}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 8, alignSelf: 'stretch', ...dragSx }} />

      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          height: 1,
          color: appBarForeground(theme),
          ...noDragSx,
        }}
      >
        <IconButton
          size="small"
          aria-label="Minimize"
          onClick={() => {
            void api.windowMinimize?.();
          }}
          sx={{
            color: 'inherit',
            borderRadius: 0,
            px: 1.25,
            '&:hover': {
              bgcolor: (t) =>
                t.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            },
          }}
        >
          <RemoveIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton
          size="small"
          aria-label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => {
            void api.windowToggleMaximize?.();
          }}
          sx={{
            color: 'inherit',
            borderRadius: 0,
            px: 1.25,
            '&:hover': {
              bgcolor: (t) =>
                t.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            },
          }}
        >
          {maximized ? (
            <FilterNoneIcon sx={{ fontSize: 16 }} />
          ) : (
            <CropSquareIcon sx={{ fontSize: 16 }} />
          )}
        </IconButton>
        <IconButton
          size="small"
          aria-label="Close"
          onClick={() => {
            void api.windowClose?.();
          }}
          sx={{
            color: 'inherit',
            borderRadius: 0,
            px: 1.25,
            '&:hover': { bgcolor: 'rgba(220,38,38,0.85)' },
          }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
