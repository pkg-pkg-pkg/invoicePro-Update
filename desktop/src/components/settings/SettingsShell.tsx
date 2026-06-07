import React, { useEffect, useMemo, useState } from 'react';
import { Box, InputAdornment, Paper, Stack, TextField, Typography, alpha, useTheme } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SettingsTopNav from './SettingsTopNav';
import SettingsQuickActions from './SettingsQuickActions';
import {
  filterSettingsNav,
  sectionLabel,
  type SettingsSectionId,
} from './settingsNavConfig';

const SECTIONS_WITH_OWN_HEADER: SettingsSectionId[] = ['company', 'about'];

interface Props {
  activeSection: SettingsSectionId;
  onSectionChange: (id: SettingsSectionId) => void;
  onBackupNow: () => void;
  onRestore: () => void;
  onAddUser: () => void;
  canBackup?: boolean;
  canRestore?: boolean;
  canManageUsers?: boolean;
  children: React.ReactNode;
}

export default function SettingsShell({
  activeSection,
  onSectionChange,
  onBackupNow,
  onRestore,
  onAddUser,
  canBackup,
  canRestore,
  canManageUsers,
  children,
}: Props) {
  const theme = useTheme();
  const [search, setSearch] = useState('');

  const filteredNav = useMemo(() => filterSettingsNav(search), [search]);

  useEffect(() => {
    if (search && filteredNav.length > 0 && !filteredNav.some((i) => i.id === activeSection)) {
      onSectionChange(filteredNav[0].id);
    }
  }, [search, filteredNav, activeSection, onSectionChange]);

  return (
    <Box
      sx={{
        p: { xs: 1.5, md: 2 },
        maxWidth: 1440,
        mx: 'auto',
        bgcolor: 'var(--bg-section)',
        borderRadius: '16px',
        minHeight: 'calc(100vh - 120px)',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ md: 'flex-end' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: -0.3 }}>
            Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Company, security, backup, network &amp; app configuration
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Search settings…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', md: 320 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            sx: { borderRadius: 2.5, bgcolor: 'var(--bg-card)' },
          }}
        />
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, md: 2 },
          mb: 1.5,
          borderRadius: 3,
          border: '1px solid var(--border)',
          bgcolor: 'var(--bg-card)',
          boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.04)}`,
        }}
      >
        <SettingsQuickActions
          onBackupNow={onBackupNow}
          onRestore={onRestore}
          onWhatsApp={() => onSectionChange('whatsapp')}
          onAddUser={onAddUser}
          onCompanyProfile={() => onSectionChange('company')}
          canBackup={canBackup}
          canRestore={canRestore}
          canManageUsers={canManageUsers}
        />
      </Paper>

      <Box sx={{ mb: 1.5 }}>
        <SettingsTopNav
          items={filteredNav}
          activeSection={activeSection}
          onSelect={onSectionChange}
        />
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          border: '1px solid var(--border)',
          bgcolor: 'var(--bg-card)',
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.05)}`,
          minHeight: 520,
          overflow: 'hidden',
        }}
      >
        {!SECTIONS_WITH_OWN_HEADER.includes(activeSection) && (
          <Typography
            variant="overline"
            color="primary"
            sx={{ fontWeight: 800, letterSpacing: 1.2, display: 'block', mb: 1 }}
          >
            {sectionLabel(activeSection)}
          </Typography>
        )}
        {children}
      </Paper>
    </Box>
  );
}

export function SettingsSectionBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" fontWeight={800} gutterBottom>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {subtitle}
        </Typography>
      )}
      {children}
    </Box>
  );
}
