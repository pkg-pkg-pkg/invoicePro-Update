import { Box, Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { Bar, BarChart, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { sectionEyebrowSx, sectionTitleSx, useDashboardTheme } from './dashboardTheme';

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
  const dt = useDashboardTheme();

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: dt.cardRadius,
        border: `1px solid ${dt.border}`,
        boxShadow: dt.cardShadow,
        fontFamily: dt.fontFamily,
        bgcolor: dt.surface,
        transition: dt.transition,
        '&:hover': { boxShadow: dt.cardShadowHover },
      }}
    >
      <CardContent sx={{ p: 2.25 }}>
        <Typography sx={{ ...sectionTitleSx(dt), mb: 0.25 }}>Business Health</Typography>
        <Typography sx={{ ...sectionEyebrowSx(dt), mb: 2 }}>This month · quick financial overview</Typography>
        <Grid container spacing={1.5}>
          {metrics.map((m) => {
            const growth = m.growthPct ?? 0;
            const up = m.growthUp ?? growth >= 0;
            const trendColor = up ? dt.status.ok : dt.status.error;
            return (
              <Grid item xs={12} sm={6} key={m.label}>
                <Stack
                  spacing={0.75}
                  sx={{
                    p: 1.5,
                    borderRadius: dt.innerRadius,
                    bgcolor: alpha(m.color, 0.05),
                    border: '1px solid',
                    borderColor: alpha(m.color, 0.12),
                    transition: dt.transition,
                    height: '100%',
                    ...(dt.enterprise
                      ? { '&:hover': { bgcolor: alpha(m.color, 0.07) } }
                      : {
                          '&:hover': {
                            bgcolor: alpha(m.color, 0.09),
                            transform: dt.hoverLift,
                            boxShadow: dt.cardShadow,
                          },
                        }),
                  }}
                >
                  <Typography sx={{ ...sectionEyebrowSx(dt), color: dt.text.secondary }}>
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
