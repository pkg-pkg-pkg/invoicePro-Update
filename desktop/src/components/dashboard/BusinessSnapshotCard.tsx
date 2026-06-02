import { Box, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DASHBOARD_THEME, dashboardCardSx, sectionEyebrowSx } from './dashboardTheme';

export interface SnapshotItem {
  label: string;
  value: string;
  accent?: string;
  onClick?: () => void;
}

export interface BusinessSnapshotCardProps {
  items: SnapshotItem[];
  isDark: boolean;
}

export function BusinessSnapshotCard({ items, isDark }: BusinessSnapshotCardProps) {
  return (
    <Paper elevation={0} sx={{ ...dashboardCardSx(isDark), p: 1.5 }}>
      <Typography sx={{ ...sectionEyebrowSx, mb: 1.25 }}>Business snapshot</Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1,
        }}
      >
        {items.map((item) => {
          const accent = item.accent ?? DASHBOARD_THEME.primary;
          const clickable = Boolean(item.onClick);
          return (
            <Box
              key={item.label}
              component={clickable ? 'button' : 'div'}
              type={clickable ? 'button' : undefined}
              onClick={item.onClick}
              sx={{
                textAlign: 'left',
                border: '1px solid',
                borderColor: alpha(accent, 0.12),
                borderRadius: DASHBOARD_THEME.innerRadius,
                bgcolor: isDark ? alpha(accent, 0.08) : alpha(accent, 0.04),
                p: 1.25,
                cursor: clickable ? 'pointer' : 'default',
                transition: DASHBOARD_THEME.transition,
                fontFamily: 'inherit',
                ...(clickable
                  ? {
                      '&:hover': {
                        transform: DASHBOARD_THEME.hoverLift,
                        boxShadow: DASHBOARD_THEME.cardShadow,
                        borderColor: alpha(accent, 0.28),
                      },
                    }
                  : {}),
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  fontWeight: 600,
                  color: DASHBOARD_THEME.text.muted,
                  fontSize: '0.6875rem',
                  mb: 0.35,
                }}
              >
                {item.label}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: '1rem',
                  letterSpacing: '-0.02em',
                  color: accent,
                  fontFeatureSettings: '"tnum"',
                  lineHeight: 1.2,
                }}
              >
                {item.value}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
