import { useRef } from 'react';
import { Box, Card, CardContent, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { useDashboardTheme, type DashboardThemeTokens } from './dashboardTheme';

export type KpiSparkPoint = { name: string; value: number };

export interface PremiumKpiCardProps {
  title: string;
  value: number;
  trendPct: number;
  trendUp: boolean;
  color: string;
  icon: React.ReactNode;
  graphData: KpiSparkPoint[];
  /** Single click — open drill-down report */
  onDrill?: () => void;
  /** Double click — open full module */
  onOpenModule?: () => void;
  drillHint?: string;
}

export function PremiumKpiCard({
  title,
  value,
  trendPct,
  trendUp,
  color,
  icon,
  graphData,
  onDrill,
  onOpenModule,
  drillHint,
}: PremiumKpiCardProps) {
  const dt = useDashboardTheme();
  const trendColor = trendUp ? dt.success : dt.danger;
  const compact = Boolean(dt.enterprise);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    if (!onDrill && !onOpenModule) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      onDrill?.();
      clickTimer.current = null;
    }, 220);
  };

  const handleDoubleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    onOpenModule?.();
  };

  const clickable = Boolean(onDrill || onOpenModule);
  const hint =
    drillHint ??
    (onDrill && onOpenModule
      ? 'Click for details · Double-click for full module'
      : onDrill
        ? 'Click to view details'
        : undefined);

  const card = (
    <Card
      elevation={0}
      onClick={clickable ? handleClick : undefined}
      onDoubleClick={clickable ? handleDoubleClick : undefined}
      sx={{
        height: '100%',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
        minHeight: dt.kpiMinHeight ?? 168,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        cursor: clickable ? 'pointer' : 'default',
        borderRadius: dt.cardRadius,
        border: `1px solid ${dt.border}`,
        boxShadow: dt.cardShadow,
        transition: dt.transition,
        fontFamily: dt.fontFamily,
        bgcolor: dt.surface,
        ...(compact
          ? {
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: color,
              },
            }
          : {
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                borderRadius: `${dt.cardRadius} ${dt.cardRadius} 0 0`,
                background: color,
              },
            }),
        '&:hover': compact
          ? { boxShadow: dt.cardShadowHover, borderColor: dt.border }
          : {
              transform: dt.hoverLift,
              boxShadow: dt.cardShadowHover,
              borderColor: alpha(color, 0.25),
            },
      }}
    >
      <CardContent
        sx={{
          p: compact ? 1.75 : 2.25,
          pt: compact ? 2 : 2.75,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          '&:last-child': { pb: compact ? 1.5 : 2 },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.5, minWidth: 0 }}>
          <Typography
            title={title}
            sx={{
              fontSize: compact ? '0.625rem' : '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: dt.text.secondary,
              flex: 1,
              minWidth: 0,
              pr: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </Typography>
          <Box
            sx={{
              width: compact ? 32 : 44,
              height: compact ? 32 : 44,
              borderRadius: compact ? '8px' : '12px',
              flexShrink: 0,
              bgcolor: alpha(color, compact ? 0.08 : 0.1),
              color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${alpha(color, 0.12)}`,
              '& .MuiSvgIcon-root': { fontSize: compact ? 18 : 22 },
            }}
          >
            {icon}
          </Box>
        </Stack>

        <Typography
          title={formatCurrency(value)}
          sx={{
            fontSize: compact
              ? { xs: 'clamp(0.95rem, 2.2vw, 1.375rem)', sm: 'clamp(1.05rem, 1.8vw, 1.5rem)' }
              : { xs: 'clamp(1.1rem, 2.5vw, 1.75rem)', sm: 'clamp(1.25rem, 2vw, 2.125rem)' },
            fontWeight: compact ? 700 : 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            fontFeatureSettings: '"tnum"',
            color: dt.text.primary,
            width: '100%',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {formatCurrency(value)}
        </Typography>

        <Stack
          direction="row"
          alignItems="center"
          spacing={0.4}
          sx={{ mt: 0.5, mb: compact ? 0.5 : 1, minWidth: 0, overflow: 'hidden' }}
        >
          {trendUp ? (
            <TrendingUpIcon sx={{ fontSize: 14, color: trendColor }} />
          ) : (
            <TrendingDownIcon sx={{ fontSize: 14, color: trendColor }} />
          )}
          <Typography
            variant="caption"
            sx={{
              color: trendColor,
              fontWeight: 600,
              fontSize: '0.6875rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {trendPct}% vs prior period
          </Typography>
        </Stack>

        {!compact ? (
          <Box sx={{ mt: 'auto', height: 44, mx: -0.5, pt: 0.5 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={graphData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Box sx={{ mt: 'auto', height: 28, mx: -0.5, opacity: 0.85 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={graphData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={alpha(color, 0.7)}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  if (!hint) return card;
  return (
    <Tooltip title={hint} arrow placement="top">
      <Box sx={{ height: '100%', width: '100%', minWidth: 0 }}>{card}</Box>
    </Tooltip>
  );
}

export function kpiColors(dt: DashboardThemeTokens) {
  return dt.kpi;
}
