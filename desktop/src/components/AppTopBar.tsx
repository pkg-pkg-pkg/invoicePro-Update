import React from 'react';
import { Box } from '@mui/material';

export type AppTopBarProps = {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
};

/**
 * Fixed three-zone top bar: left (title), center (search), right (user cluster).
 */
export default function AppTopBar({ left, center, right }: AppTopBarProps) {
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
      <Box sx={{ flex: '0 1 34%', minWidth: 0, display: 'flex', alignItems: 'center' }}>{left}</Box>
      <Box
        sx={{
          flex: '1 1 32%',
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
          flex: '0 1 34%',
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
