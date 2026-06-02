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
import { alpha, useTheme } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { HealthStatusRow } from '../../utils/dashboardHealth';
import { DASHBOARD_THEME, sectionEyebrowSx } from './dashboardTheme';

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

function statusColor(level: HealthStatusRow['level']): string {
  if (level === 'ok') return DASHBOARD_THEME.status.ok;
  if (level === 'error') return DASHBOARD_THEME.status.error;
  return DASHBOARD_THEME.status.warn;
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const visibleSuggestions = compact ? suggestions.slice(0, 4) : suggestions;

  return (
    <Card
      elevation={0}
      sx={{
        minHeight: compact ? 520 : undefined,
        borderRadius: DASHBOARD_THEME.cardRadius,
        border: '1px solid',
        borderColor: alpha(DASHBOARD_THEME.primary, isDark ? 0.35 : 0.14),
        overflow: 'hidden',
        boxShadow: DASHBOARD_THEME.cardShadow,
        transition: DASHBOARD_THEME.transition,
        fontFamily: DASHBOARD_THEME.fontFamily,
        bgcolor: isDark ? alpha('#1E293B', 0.9) : '#FFFFFF',
        '&:hover': { boxShadow: DASHBOARD_THEME.cardShadowHover },
      }}
    >
      <Box
        sx={{
          px: compact ? 2 : 2.25,
          py: compact ? 1.75 : 1.5,
          background: isDark
            ? `linear-gradient(125deg, ${alpha(DASHBOARD_THEME.primary, 0.45)} 0%, ${alpha('#1E293B', 0.95)} 55%)`
            : `linear-gradient(125deg, ${DASHBOARD_THEME.primary} 0%, #3B82F6 48%, ${alpha('#6366F1', 0.9)} 100%)`,
          color: '#fff',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: compact ? 42 : 36,
                height: compact ? 42 : 36,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha('#fff', 0.18),
                backdropFilter: 'blur(8px)',
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: compact ? 22 : 20 }} />
            </Box>
            <Box>
              <Typography
                fontWeight={800}
                fontSize={compact ? '1.0625rem' : '0.9375rem'}
                letterSpacing="-0.02em"
              >
                PVE Smart Assistant
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 500 }}>
                AI-powered business insights
              </Typography>
            </Box>
          </Stack>
          <Chip
            label="AI"
            size="small"
            sx={{
              height: 22,
              fontWeight: 800,
              bgcolor: alpha('#fff', 0.2),
              color: '#fff',
              border: `1px solid ${alpha('#fff', 0.35)}`,
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
            p: compact ? 1.5 : 1.5,
            mb: compact ? 1.5 : 1.75,
            borderRadius: DASHBOARD_THEME.innerRadius,
            border: '1px solid',
            borderColor: alpha(DASHBOARD_THEME.primary, 0.12),
            background: isDark
              ? alpha(DASHBOARD_THEME.primary, 0.08)
              : `linear-gradient(180deg, ${alpha(DASHBOARD_THEME.primarySoft, 0.9)} 0%, ${alpha('#fff', 0.95)} 100%)`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.75 }}>
            <Typography sx={{ ...sectionEyebrowSx, color: DASHBOARD_THEME.text.secondary }}>
              Business Health Score
            </Typography>
            <Typography fontWeight={800} fontSize={compact ? '1.75rem' : '1.5rem'} color={DASHBOARD_THEME.primary}>
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
              height: 6,
              borderRadius: 3,
              mb: 1.25,
              bgcolor: alpha(DASHBOARD_THEME.primary, 0.12),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                background: `linear-gradient(90deg, ${DASHBOARD_THEME.primary} 0%, #6366F1 100%)`,
              },
            }}
          />
          <Stack spacing={0.65}>
            {healthStatuses.map((row) => (
              <Stack key={row.label} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" fontWeight={600} color={DASHBOARD_THEME.text.secondary}>
                  {row.label}
                </Typography>
                <Chip
                  size="small"
                  label={row.status}
                  sx={{
                    height: 20,
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    bgcolor: alpha(statusColor(row.level), 0.12),
                    color: statusColor(row.level),
                    border: `1px solid ${alpha(statusColor(row.level), 0.25)}`,
                  }}
                />
              </Stack>
            ))}
          </Stack>
        </Box>

        <Typography sx={{ ...sectionEyebrowSx, mb: 1 }}>Today&apos;s suggestions</Typography>
        <List dense disablePadding>
          {visibleSuggestions.map((s, i) => (
            <ListItem
              key={i}
              disableGutters
              sx={{
                py: compact ? 0.65 : 0.55,
                alignItems: 'flex-start',
                borderBottom:
                  i < visibleSuggestions.length - 1 ? `1px solid ${DASHBOARD_THEME.border}` : 'none',
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
                  bgcolor: alpha(DASHBOARD_THEME.primary, 0.1),
                  color: DASHBOARD_THEME.primary,
                }}
              />
              <ListItemText
                primary={s.text}
                primaryTypographyProps={{
                  variant: 'body2',
                  lineHeight: 1.45,
                  fontSize: '0.8125rem',
                  color: DASHBOARD_THEME.text.primary,
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
              fontWeight: 700,
              py: compact ? 1.1 : 1,
              borderRadius: DASHBOARD_THEME.innerRadius,
              boxShadow: `0 4px 14px ${alpha(DASHBOARD_THEME.primary, 0.35)}`,
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
              borderRadius: DASHBOARD_THEME.innerRadius,
              borderColor: alpha(DASHBOARD_THEME.primary, 0.35),
            }}
          >
            Generate Report
          </Button>
          <Button
            variant="text"
            size="small"
            fullWidth
            onClick={onViewDetails}
            sx={{ textTransform: 'none', fontWeight: 600, color: DASHBOARD_THEME.text.secondary }}
          >
            View Details
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
