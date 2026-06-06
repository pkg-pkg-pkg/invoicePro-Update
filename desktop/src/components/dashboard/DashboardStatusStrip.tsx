import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useDashboardTheme } from './dashboardTheme';

export interface StatusStripItem {
  label: string;
  value: string;
  ok?: boolean;
}

export interface DashboardStatusStripProps {
  items: StatusStripItem[];
}

function StatusIndicator({ ok = true, color }: { ok?: boolean; color: string }) {
  const indicatorColor = ok ? color : color;
  return (
    <Box
      sx={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        bgcolor: indicatorColor,
        boxShadow: `0 0 0 2px ${alpha(indicatorColor, 0.25)}`,
        flexShrink: 0,
      }}
    />
  );
}

export function DashboardStatusStrip({ items }: DashboardStatusStripProps) {
  const dt = useDashboardTheme();

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 2.5,
        px: 2,
        py: 1.1,
        borderRadius: dt.cardRadius,
        border: '1px solid',
        borderColor: dt.border,
        bgcolor: dt.surface,
        boxShadow: dt.cardShadow,
        fontFamily: dt.fontFamily,
        transition: dt.transition,
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
            sx={{ borderColor: dt.border, mx: 1.25, my: 0.35 }}
          />
        }
        spacing={0}
        gap={0.5}
      >
        {items.map((item) => (
          <Stack key={item.label} direction="row" alignItems="center" spacing={0.75}>
            {item.ok !== undefined ? (
              <StatusIndicator ok={item.ok} color={item.ok ? dt.status.ok : dt.status.warn} />
            ) : null}
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.75rem',
                color: dt.text.secondary,
                fontWeight: 500,
              }}
            >
              <Box component="span" sx={{ fontWeight: 700, color: dt.text.primary }}>
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
