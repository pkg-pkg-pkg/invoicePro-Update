import { Box, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { dashboardCardSx, sectionEyebrowSx, useDashboardTheme } from './dashboardTheme';

export interface SnapshotItem {
  label: string;
  value: string;
  accent?: string;
  onClick?: () => void;
}

export interface BusinessSnapshotCardProps {
  items: SnapshotItem[];
}

export function BusinessSnapshotCard({ items }: BusinessSnapshotCardProps) {
  const dt = useDashboardTheme();
  const compact = Boolean(dt.enterprise);

  return (
    <Paper elevation={0} sx={{ ...dashboardCardSx(dt), p: compact ? 1.5 : 2 }}>
      <Typography
        sx={{
          ...sectionEyebrowSx(dt),
          mb: compact ? 1 : 1.5,
          color: dt.text.secondary,
          fontSize: compact ? '0.625rem' : undefined,
        }}
      >
        Business snapshot
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: compact ? 0.85 : 1.25,
        }}
      >
        {items.map((item) => {
          const accent = item.accent ?? dt.primary;
          const clickable = Boolean(item.onClick);
          return (
            <Box
              key={item.label}
              component={clickable ? 'button' : 'div'}
              type={clickable ? 'button' : undefined}
              onClick={item.onClick}
              sx={{
                textAlign: 'left',
                border: `1px solid ${dt.border}`,
                borderRadius: dt.innerRadius,
                bgcolor: compact ? dt.bgSubtle : undefined,
                background: compact
                  ? dt.bgSubtle
                  : `linear-gradient(145deg, ${dt.surface} 0%, ${alpha(accent, 0.06)} 100%)`,
                p: compact ? 1.1 : 1.5,
                cursor: clickable ? 'pointer' : 'default',
                transition: dt.transition,
                fontFamily: 'inherit',
                color: 'inherit',
                ...(clickable
                  ? {
                      '&:hover': compact
                        ? { bgcolor: alpha('#fff', 0.03), borderColor: dt.border }
                        : {
                            transform: dt.hoverLift,
                            boxShadow: dt.cardShadow,
                            borderColor: alpha(accent, 0.22),
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
                  color: dt.text.secondary,
                  fontSize: compact ? '0.625rem' : '0.6875rem',
                  mb: 0.25,
                }}
              >
                {item.label}
              </Typography>
              <Typography
                sx={{
                  fontWeight: compact ? 700 : 800,
                  fontSize: compact ? '0.9375rem' : '1.0625rem',
                  letterSpacing: '-0.02em',
                  color: compact ? dt.text.primary : accent,
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
