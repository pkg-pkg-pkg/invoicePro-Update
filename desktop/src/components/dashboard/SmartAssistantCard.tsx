import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { HealthStatusRow } from '../../utils/dashboardHealth';
import { sectionEyebrowSx, useDashboardTheme, type DashboardThemeTokens } from './dashboardTheme';

export interface SmartSuggestion {
  text: string;
}

export interface SmartAssistantCardProps {
  suggestions: SmartSuggestion[];
  onWhatsApp: () => void;
  onGenerateReport: () => void;
  onViewDetails: () => void;
  compact?: boolean;
  whatsAppLoading?: boolean;
  healthScore?: number;
  healthStatuses?: HealthStatusRow[];
}

function statusColor(dt: DashboardThemeTokens, level: HealthStatusRow['level']): string {
  if (level === 'ok') return dt.status.ok;
  if (level === 'error') return dt.status.error;
  return dt.status.warn;
}

export function SmartAssistantCard({
  suggestions,
  onWhatsApp,
  onGenerateReport,
  onViewDetails,
  compact = false,
  whatsAppLoading = false,
  healthScore = 84,
  healthStatuses = [],
}: SmartAssistantCardProps) {
  const dt = useDashboardTheme();
  const visibleSuggestions = compact ? suggestions.slice(0, 4) : suggestions;
  const enterprise = Boolean(dt.enterprise);

  return (
    <Card
      elevation={0}
      sx={{
        minHeight: compact ? 480 : undefined,
        borderRadius: dt.cardRadius,
        border: `1px solid ${dt.border}`,
        overflow: 'hidden',
        boxShadow: dt.cardShadow,
        transition: dt.transition,
        fontFamily: dt.fontFamily,
        bgcolor: dt.surface,
        '&:hover': { boxShadow: enterprise ? dt.cardShadowHover : dt.cardShadowHover },
      }}
    >
      <Box
        sx={{
          px: compact ? 1.75 : 2.25,
          py: compact ? 1.25 : 1.5,
          ...(enterprise
            ? {
                bgcolor: dt.assistantHeaderBg ?? dt.bgSubtle,
                color: dt.text.primary,
                borderBottom: `1px solid ${dt.border}`,
              }
            : {
                background: dt.assistantGradient,
                color: '#fff',
              }),
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: compact ? 36 : 36,
                height: compact ? 36 : 36,
                borderRadius: enterprise ? '8px' : '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: enterprise ? alpha(dt.primary, 0.1) : alpha('#fff', 0.18),
                color: enterprise ? dt.primary : 'inherit',
                border: enterprise ? `1px solid ${dt.border}` : 'none',
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: compact ? 20 : 20 }} />
            </Box>
            <Box>
              <Typography
                fontWeight={700}
                fontSize={compact ? '0.9375rem' : '0.9375rem'}
                letterSpacing="-0.01em"
                color={enterprise ? dt.text.primary : 'inherit'}
              >
                PVE Smart Assistant
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  opacity: enterprise ? 1 : 0.9,
                  fontWeight: 500,
                  color: enterprise ? dt.text.secondary : 'inherit',
                }}
              >
                Business insights &amp; reminders
              </Typography>
            </Box>
          </Stack>
          <Chip
            label="AI"
            size="small"
            sx={{
              height: 22,
              fontWeight: 700,
              fontSize: '0.625rem',
              ...(enterprise
                ? {
                    bgcolor: alpha(dt.accent, 0.12),
                    color: dt.accent,
                    border: `1px solid ${alpha(dt.accent, 0.25)}`,
                  }
                : {
                    bgcolor: alpha('#fff', 0.2),
                    color: '#fff',
                    border: `1px solid ${alpha('#fff', 0.35)}`,
                  }),
            }}
          />
        </Stack>
      </Box>

      <CardContent
        sx={{
          p: compact ? 2 : 2.25,
          pt: compact ? 1.75 : 2,
          '&:last-child': { pb: compact ? 2 : 2.25 },
        }}
      >
        <Box
          sx={{
            p: 1.5,
            mb: compact ? 1.5 : 1.75,
            borderRadius: dt.innerRadius,
            border: `1px solid ${dt.border}`,
            bgcolor: enterprise ? dt.bgSubtle : alpha(dt.primarySoft, 0.65),
          }}
        >
          <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.75 }}>
            <Typography sx={{ ...sectionEyebrowSx(dt), color: dt.text.secondary }}>
              Business Health Score
            </Typography>
            <Typography fontWeight={700} fontSize={compact ? '1.5rem' : '1.5rem'} color={dt.text.primary}>
              {healthScore}
              <Typography component="span" fontSize="0.875rem" color="text.secondary" fontWeight={600}>
                {' '}
                / 100
              </Typography>
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={healthScore}
            sx={{
              height: 4,
              borderRadius: 2,
              mb: 1.25,
              bgcolor: alpha(dt.primary, 0.1),
              '& .MuiLinearProgress-bar': {
                borderRadius: 2,
                bgcolor: dt.primary,
              },
            }}
          />
          <Stack spacing={0.65}>
            {healthStatuses.map((row) => (
              <Stack key={row.label} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" fontWeight={600} color={dt.text.secondary}>
                  {row.label}
                </Typography>
                <Chip
                  size="small"
                  label={row.status}
                  sx={{
                    height: 20,
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    bgcolor: alpha(statusColor(dt, row.level), 0.12),
                    color: statusColor(dt, row.level),
                    border: `1px solid ${alpha(statusColor(dt, row.level), 0.25)}`,
                  }}
                />
              </Stack>
            ))}
          </Stack>
        </Box>

        <Typography sx={{ ...sectionEyebrowSx(dt), mb: 1 }}>Today&apos;s suggestions</Typography>
        <List dense disablePadding>
          {visibleSuggestions.map((s, i) => (
            <ListItem
              key={i}
              disableGutters
              sx={{
                py: compact ? 0.65 : 0.55,
                alignItems: 'flex-start',
                borderBottom: i < visibleSuggestions.length - 1 ? `1px solid ${dt.border}` : 'none',
              }}
            >
              <Chip
                label={i + 1}
                size="small"
                sx={{
                  height: 18,
                  minWidth: 22,
                  mr: 1,
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  bgcolor: alpha(dt.primary, 0.1),
                  color: dt.primary,
                }}
              />
              <ListItemText
                primary={s.text}
                primaryTypographyProps={{
                  variant: 'body2',
                  lineHeight: 1.45,
                  fontSize: '0.8125rem',
                  color: dt.text.primary,
                  fontWeight: 500,
                }}
              />
            </ListItem>
          ))}
        </List>

        <Stack spacing={0.85} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            size={compact ? 'medium' : 'small'}
            fullWidth
            disabled={whatsAppLoading}
            onClick={onWhatsApp}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              py: compact ? 1 : 1,
              borderRadius: dt.innerRadius,
              boxShadow: enterprise ? 'none' : `0 4px 14px ${alpha(dt.primary, 0.35)}`,
            }}
          >
            {whatsAppLoading ? 'Preparing…' : 'Send Reminder'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            fullWidth
            onClick={onGenerateReport}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: dt.innerRadius,
              borderColor: alpha(dt.primary, 0.35),
            }}
          >
            Generate Report
          </Button>
          <Button
            variant="text"
            size="small"
            fullWidth
            onClick={onViewDetails}
            sx={{ textTransform: 'none', fontWeight: 600, color: dt.text.secondary }}
          >
            View Details
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
