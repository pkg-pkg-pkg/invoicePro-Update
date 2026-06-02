import type { ReactNode } from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  DASHBOARD_THEME,
  dashboardCardSx,
  sectionEyebrowSx,
  sectionTitleSx,
} from './dashboardTheme';

export interface SystemHealthItem {
  label: string;
  status: string;
  ok: boolean;
}

export interface UtilitySidebarProps {
  open: boolean;
  onToggle: () => void;
  shortcuts: Array<{ label: string; onClick: () => void }>;
  systemHealth: SystemHealthItem[];
  assistantSlot?: ReactNode;
  agingSlot?: ReactNode;
}

function HealthRow({ label, status, ok }: SystemHealthItem) {
  const color = ok ? DASHBOARD_THEME.status.ok : DASHBOARD_THEME.status.warn;
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.25 }}>
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Box component="span" sx={{ fontSize: '0.75rem', lineHeight: 1 }}>
          {ok ? '🟢' : '🟡'}
        </Box>
        <Typography variant="body2" fontWeight={600} color={DASHBOARD_THEME.text.primary} fontSize="0.8125rem">
          {label}
        </Typography>
      </Stack>
      <Typography variant="caption" fontWeight={700} sx={{ color, fontSize: '0.6875rem' }}>
        {status}
      </Typography>
    </Stack>
  );
}

export function UtilitySidebar({
  open,
  onToggle,
  shortcuts,
  systemHealth,
  assistantSlot,
  agingSlot,
}: UtilitySidebarProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!open) {
    return (
      <Box sx={{ position: { lg: 'sticky' }, top: 12 }}>
        <IconButton
          onClick={onToggle}
          aria-label="Open utility panel"
          sx={{
            width: 40,
            height: 40,
            bgcolor: isDark ? alpha('#fff', 0.06) : '#FFFFFF',
            border: '1px solid',
            borderColor: DASHBOARD_THEME.border,
            borderRadius: DASHBOARD_THEME.innerRadius,
            boxShadow: DASHBOARD_THEME.cardShadow,
            transition: DASHBOARD_THEME.transition,
            '&:hover': { bgcolor: DASHBOARD_THEME.primarySoft, transform: DASHBOARD_THEME.hoverLift },
          }}
        >
          <ChevronRightIcon sx={{ transform: 'rotate(180deg)', fontSize: 20 }} />
        </IconButton>
      </Box>
    );
  }

  const panelSx = {
    ...dashboardCardSx(isDark),
    p: 1.5,
    transition: DASHBOARD_THEME.transition,
  };

  return (
    <Stack
      spacing={2}
      sx={{
        fontFamily: DASHBOARD_THEME.fontFamily,
        width: '100%',
        position: { lg: 'sticky' },
        top: 12,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="flex-end">
        <IconButton
          size="small"
          onClick={onToggle}
          aria-label="Collapse utility panel"
          sx={{
            border: '1px solid',
            borderColor: DASHBOARD_THEME.border,
            borderRadius: DASHBOARD_THEME.innerRadius,
          }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Stack>

      {assistantSlot ? <Box sx={{ flexShrink: 0 }}>{assistantSlot}</Box> : null}
      {agingSlot ? <Box sx={{ flexShrink: 0 }}>{agingSlot}</Box> : null}

      <Paper elevation={0} sx={panelSx}>
        <Typography sx={{ ...sectionEyebrowSx, mb: 0.75 }}>Quick links</Typography>
        <Stack spacing={0} divider={<Divider sx={{ borderColor: DASHBOARD_THEME.border }} />}>
          {shortcuts.map((s) => (
            <Button
              key={s.label}
              size="small"
              variant="text"
              onClick={s.onClick}
              sx={{
                justifyContent: 'space-between',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8125rem',
                py: 0.85,
                px: 0.5,
                color: DASHBOARD_THEME.text.primary,
                borderRadius: DASHBOARD_THEME.innerRadius,
                '&:hover': { bgcolor: DASHBOARD_THEME.primarySoft },
              }}
            >
              {s.label}
              <SwapHorizIcon sx={{ fontSize: 14, color: DASHBOARD_THEME.text.muted }} />
            </Button>
          ))}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={panelSx}>
        <Typography sx={{ ...sectionEyebrowSx, mb: 1 }}>System health</Typography>
        <Stack spacing={0.5}>
          {systemHealth.map((item) => (
            <HealthRow key={item.label} {...item} />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
