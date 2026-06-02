import React from 'react';
import { Box } from '@mui/material';

export type AppTopBarProps = {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  /** Wider center zone for global command-style search */
  wideSearch?: boolean;
};

/**
 * Fixed three-zone top bar: left (title), center (search), right (user cluster).
 */
export default function AppTopBar({ left, center, right, wideSearch = false }: AppTopBarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        gap: { xs: 1, sm: 1.5 },
        px: { xs: 0.5, sm: 1 },
      }}
    >
      <Box
        sx={{
          flex: wideSearch ? '0 1 22%' : '0 1 34%',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {left}
      </Box>
      <Box
        sx={{
          flex: wideSearch ? '1 1 55%' : '1 1 32%',
          maxWidth: wideSearch ? '55%' : undefined,
          minWidth: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          px: 0.5,
        }}
      >
        {center}
      </Box>
      <Box
        sx={{
          flex: wideSearch ? '0 1 23%' : '0 1 34%',
          minWidth: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        {right}
      </Box>
    </Box>
  );
}
