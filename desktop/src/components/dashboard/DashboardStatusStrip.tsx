import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { DASHBOARD_THEME } from './dashboardTheme';

export interface StatusStripItem {
  label: string;
  value: string;
  ok?: boolean;
}

export interface DashboardStatusStripProps {
  items: StatusStripItem[];
}

function StatusIndicator({ ok = true }: { ok?: boolean }) {
  const color = ok ? DASHBOARD_THEME.status.ok : DASHBOARD_THEME.status.warn;
  return (
    <Box
      sx={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        bgcolor: color,
        boxShadow: `0 0 0 2px ${alpha(color, 0.25)}`,
        flexShrink: 0,
      }}
    />
  );
}

export function DashboardStatusStrip({ items }: DashboardStatusStripProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 2.5,
        px: 2,
        py: 1.1,
        borderRadius: DASHBOARD_THEME.cardRadius,
        border: '1px solid',
        borderColor: isDark ? alpha('#fff', 0.08) : DASHBOARD_THEME.border,
        bgcolor: isDark ? alpha('#1E293B', 0.55) : '#FFFFFF',
        boxShadow: DASHBOARD_THEME.cardShadow,
        fontFamily: DASHBOARD_THEME.fontFamily,
      }}
    >
      <Stack
        direction="row"
        flexWrap="wrap"
        alignItems="center"
        divider={
          <Divider
            orientation="vertical"
            flexItem
            sx={{ borderColor: DASHBOARD_THEME.border, mx: 1.25, my: 0.35 }}
          />
        }
        spacing={0}
        gap={0.5}
      >
        {items.map((item) => (
          <Stack key={item.label} direction="row" alignItems="center" spacing={0.75}>
            {item.ok !== undefined ? <StatusIndicator ok={item.ok} /> : null}
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.75rem',
                color: DASHBOARD_THEME.text.secondary,
                fontWeight: 500,
              }}
            >
              <Box component="span" sx={{ fontWeight: 700, color: DASHBOARD_THEME.text.primary }}>
                {item.label}
              </Box>
              {' · '}
              {item.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
