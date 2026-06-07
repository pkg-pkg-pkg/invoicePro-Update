import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import type { SettingsKpis } from '../../services/settingsKpiService';

const fmtInr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

interface KpiTileProps {
  emoji: string;
  label: string;
  value: string;
  accent: string;
}

function KpiTile({ emoji, label, value, accent }: KpiTileProps) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        flex: '1 1 140px',
        minWidth: 130,
        p: 1.75,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: alpha(accent, 0.22),
        bgcolor: alpha(accent, 0.06),
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.08)}`,
        },
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
        {emoji} {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5, color: accent, lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Box>
  );
}

interface Props {
  kpis: SettingsKpis;
  loading?: boolean;
}

export default function SettingsCommandCenter({ kpis, loading }: Props) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        border: '1px solid var(--border)',
        bgcolor: 'var(--bg-card)',
        boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.04)}`,
      }}
    >
      <Typography variant="subtitle1" fontWeight={800} gutterBottom>
        Business Command Center
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Live snapshot from your active company data
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
        <KpiTile
          emoji="👥"
          label="Customers"
          value={loading ? '…' : String(kpis.totalCustomers)}
          accent={theme.palette.primary.main}
        />
        <KpiTile
          emoji="📦"
          label="Items"
          value={loading ? '…' : String(kpis.totalItems)}
          accent={theme.palette.info.main}
        />
        <KpiTile
          emoji="📄"
          label="Invoices"
          value={loading ? '…' : String(kpis.totalInvoices)}
          accent={theme.palette.secondary.main}
        />
        <KpiTile
          emoji="💰"
          label="Outstanding"
          value={loading ? '…' : fmtInr(kpis.outstandingAmount)}
          accent={theme.palette.warning.main}
        />
        <KpiTile
          emoji="🏦"
          label="Balance"
          value={loading ? '…' : fmtInr(kpis.bankBalance)}
          accent={theme.palette.success.main}
        />
      </Box>
    </Box>
  );
}
