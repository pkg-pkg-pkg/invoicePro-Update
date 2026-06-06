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
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  dashboardCardSx,
  sectionEyebrowSx,
  useDashboardTheme,
  type DashboardThemeTokens,
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

function HealthRow({ label, status, ok, dt }: SystemHealthItem & { dt: DashboardThemeTokens }) {
  const color = ok ? dt.status.ok : dt.status.warn;
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.25 }}>
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Box component="span" sx={{ fontSize: '0.75rem', lineHeight: 1 }}>
          {ok ? '🟢' : '🟡'}
        </Box>
        <Typography variant="body2" fontWeight={600} color={dt.text.primary} fontSize="0.8125rem">
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
  const dt = useDashboardTheme();

  if (!open) {
    return (
      <Box sx={{ position: { lg: 'sticky' }, top: 12 }}>
        <IconButton
          onClick={onToggle}
          aria-label="Open utility panel"
          sx={{
            width: 40,
            height: 40,
            bgcolor: dt.surface,
            border: '1px solid',
            borderColor: dt.border,
            borderRadius: dt.innerRadius,
            boxShadow: dt.cardShadow,
            transition: dt.transition,
            '&:hover': { bgcolor: dt.primarySoft, transform: dt.hoverLift },
          }}
        >
          <ChevronRightIcon sx={{ transform: 'rotate(180deg)', fontSize: 20 }} />
        </IconButton>
      </Box>
    );
  }

  const panelSx = {
    ...dashboardCardSx(dt),
    p: 1.5,
    transition: dt.transition,
  };

  return (
    <Stack
      spacing={2}
      sx={{
        fontFamily: dt.fontFamily,
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
            borderColor: dt.border,
            borderRadius: dt.innerRadius,
          }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Stack>

      {assistantSlot ? <Box sx={{ flexShrink: 0 }}>{assistantSlot}</Box> : null}
      {agingSlot ? <Box sx={{ flexShrink: 0 }}>{agingSlot}</Box> : null}

      <Paper elevation={0} sx={panelSx}>
        <Typography sx={{ ...sectionEyebrowSx(dt), mb: 0.75 }}>Quick links</Typography>
        <Stack spacing={0} divider={<Divider sx={{ borderColor: dt.border }} />}>
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
                color: dt.text.primary,
                borderRadius: dt.innerRadius,
                '&:hover': { bgcolor: dt.primarySoft },
              }}
            >
              {s.label}
              <SwapHorizIcon sx={{ fontSize: 14, color: dt.text.muted }} />
            </Button>
          ))}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={panelSx}>
        <Typography sx={{ ...sectionEyebrowSx(dt), mb: 1 }}>System health</Typography>
        <Stack spacing={0.5}>
          {systemHealth.map((item) => (
            <HealthRow key={item.label} {...item} dt={dt} />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
