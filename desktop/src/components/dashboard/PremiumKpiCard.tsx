import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { DASHBOARD_THEME } from './dashboardTheme';

export type KpiSparkPoint = { name: string; value: number };

export interface PremiumKpiCardProps {
  title: string;
  value: number;
  trendPct: number;
  trendUp: boolean;
  color: string;
  icon: React.ReactNode;
  graphData: KpiSparkPoint[];
}

export function PremiumKpiCard({
  title,
  value,
  trendPct,
  trendUp,
  color,
  icon,
  graphData,
}: PremiumKpiCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const trendColor = trendUp ? DASHBOARD_THEME.status.ok : DASHBOARD_THEME.status.error;

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 168,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        borderRadius: DASHBOARD_THEME.cardRadius,
        border: '1px solid',
        borderColor: alpha(color, 0.12),
        boxShadow: DASHBOARD_THEME.cardShadow,
        transition: DASHBOARD_THEME.transition,
        fontFamily: DASHBOARD_THEME.fontFamily,
        bgcolor: isDark ? alpha('#1E293B', 0.8) : '#FFFFFF',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          borderRadius: `${DASHBOARD_THEME.cardRadius} ${DASHBOARD_THEME.cardRadius} 0 0`,
          background: `linear-gradient(90deg, ${color} 0%, ${alpha(color, 0.35)} 100%)`,
        },
        '&:hover': {
          transform: DASHBOARD_THEME.hoverLift,
          boxShadow: DASHBOARD_THEME.cardShadowHover,
          borderColor: alpha(color, 0.22),
        },
      }}
    >
      <CardContent
        sx={{
          p: 2.25,
          pt: 2.5,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          '&:last-child': { pb: 2 },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.5 }}>
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: DASHBOARD_THEME.text.muted,
            }}
          >
            {title}
          </Typography>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '14px',
              flexShrink: 0,
              background: `linear-gradient(145deg, ${alpha(color, 0.22)} 0%, ${alpha(color, 0.06)} 100%)`,
              color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `inset 0 1px 0 ${alpha('#fff', 0.65)}`,
              '& .MuiSvgIcon-root': { fontSize: 22 },
            }}
          >
            {icon}
          </Box>
        </Stack>

        <Typography
          sx={{
            fontSize: { xs: '2rem', sm: '2.5rem', md: '2.625rem' },
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            fontFeatureSettings: '"tnum"',
            color: DASHBOARD_THEME.text.primary,
          }}
        >
          {formatCurrency(value)}
        </Typography>

        <Stack direction="row" alignItems="center" spacing={0.4} sx={{ mt: 0.75, mb: 1 }}>
          {trendUp ? (
            <TrendingUpIcon sx={{ fontSize: 16, color: trendColor }} />
          ) : (
            <TrendingDownIcon sx={{ fontSize: 16, color: trendColor }} />
          )}
          <Typography variant="caption" sx={{ color: trendColor, fontWeight: 600, fontSize: '0.75rem' }}>
            {trendPct}% vs prior period
          </Typography>
        </Stack>

        <Box sx={{ mt: 'auto', height: 48, mx: -0.5, pt: 0.5 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={graphData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.25}
                dot={false}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
