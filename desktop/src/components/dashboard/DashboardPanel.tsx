import { Paper, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { dashboardCardSx, sectionTitleSx, useDashboardTheme } from './dashboardTheme';

export interface DashboardPanelProps {
  title?: string;
  action?: ReactNode;
  accent?: string;
  fillHeight?: boolean;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

/** Consistent elevated surface for dashboard sections. */
export function DashboardPanel({
  title,
  action,
  accent,
  fillHeight = false,
  children,
  sx,
}: DashboardPanelProps) {
  const dt = useDashboardTheme();

  return (
    <Paper
      elevation={0}
      sx={{
        ...dashboardCardSx(dt, accent),
        p: 2.25,
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
          {title ? <Typography sx={sectionTitleSx(dt)}>{title}</Typography> : <span />}
          {action}
        </Stack>
      )}
      {children}
    </Paper>
  );
}
