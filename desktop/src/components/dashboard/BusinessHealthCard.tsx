import { Box, Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { Bar, BarChart, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { DASHBOARD_THEME, sectionEyebrowSx, sectionTitleSx } from './dashboardTheme';

export interface BusinessHealthMetric {
  label: string;
  value: number;
  color: string;
  chartData: Array<{ v: number }>;
  growthPct?: number;
  growthUp?: boolean;
}

export interface BusinessHealthCardProps {
  metrics: BusinessHealthMetric[];
}

export function BusinessHealthCard({ metrics }: BusinessHealthCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: DASHBOARD_THEME.cardRadius,
        border: '1px solid',
        borderColor: isDark ? alpha('#fff', 0.08) : DASHBOARD_THEME.border,
        boxShadow: DASHBOARD_THEME.cardShadow,
        fontFamily: DASHBOARD_THEME.fontFamily,
        bgcolor: isDark ? alpha('#1E293B', 0.65) : '#FFFFFF',
        transition: DASHBOARD_THEME.transition,
        '&:hover': { boxShadow: DASHBOARD_THEME.cardShadowHover },
      }}
    >
      <CardContent sx={{ p: 2.25 }}>
        <Typography sx={{ ...sectionTitleSx, mb: 0.25 }}>Business Health</Typography>
        <Typography sx={{ ...sectionEyebrowSx, mb: 2 }}>This month · quick financial overview</Typography>
        <Grid container spacing={1.5}>
          {metrics.map((m) => {
            const growth = m.growthPct ?? 0;
            const up = m.growthUp ?? growth >= 0;
            const trendColor = up ? DASHBOARD_THEME.status.ok : DASHBOARD_THEME.status.error;
            return (
              <Grid item xs={12} sm={6} key={m.label}>
                <Stack
                  spacing={0.75}
                  sx={{
                    p: 1.5,
                    borderRadius: DASHBOARD_THEME.innerRadius,
                    bgcolor: alpha(m.color, 0.05),
                    border: '1px solid',
                    borderColor: alpha(m.color, 0.12),
                    transition: DASHBOARD_THEME.transition,
                    height: '100%',
                    '&:hover': {
                      bgcolor: alpha(m.color, 0.09),
                      transform: DASHBOARD_THEME.hoverLift,
                      boxShadow: DASHBOARD_THEME.cardShadow,
                    },
                  }}
                >
                  <Typography sx={{ ...sectionEyebrowSx, color: DASHBOARD_THEME.text.secondary }}>
                    {m.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      letterSpacing: '-0.03em',
                      fontFeatureSettings: '"tnum"',
                      color: m.color,
                    }}
                  >
                    {formatCurrency(m.value)}
                  </Typography>
                  {growth !== 0 ? (
                    <Stack direction="row" alignItems="center" spacing={0.35}>
                      {up ? (
                        <TrendingUpIcon sx={{ fontSize: 14, color: trendColor }} />
                      ) : (
                        <TrendingDownIcon sx={{ fontSize: 14, color: trendColor }} />
                      )}
                      <Typography variant="caption" fontWeight={700} sx={{ color: trendColor }}>
                        {growth}% growth
                      </Typography>
                    </Stack>
                  ) : null}
                  <Box sx={{ height: 36, opacity: 0.92, mt: 0.25 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={m.chartData}>
                        <Bar dataKey="v" fill={m.color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Stack>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
}
