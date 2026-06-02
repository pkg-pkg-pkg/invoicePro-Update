import { Paper, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { dashboardCardSx, sectionTitleSx } from './dashboardTheme';

export interface DashboardPanelProps {
  title?: string;
  action?: ReactNode;
  isDark: boolean;
  accent?: string;
  /** Only set for side-by-side panels that should match row height */
  fillHeight?: boolean;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

/** Consistent elevated surface for dashboard sections. */
export function DashboardPanel({
  title,
  action,
  isDark,
  accent,
  fillHeight = false,
  children,
  sx,
}: DashboardPanelProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        ...dashboardCardSx(isDark, accent),
        p: 2.25,
        transition: 'box-shadow 300ms ease, transform 300ms ease, border-color 300ms ease',
        '&:hover': { boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)' },
        ...(fillHeight ? { height: '100%' } : {}),
        ...sx,
      }}
    >
      {(title || action) && (
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2, minHeight: 28 }}
        >
          {title ? <Typography sx={sectionTitleSx}>{title}</Typography> : <span />}
          {action}
        </Stack>
      )}
      {children}
    </Paper>
  );
}
