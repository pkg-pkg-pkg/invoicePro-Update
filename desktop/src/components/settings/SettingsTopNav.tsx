import React from 'react';
import { Box, Tab, Tabs, Typography, alpha, useTheme } from '@mui/material';
import { WrapTabScrollButton } from '../mui/WrapTabScrollButton';
import type { SettingsNavItem, SettingsSectionId } from './settingsNavConfig';

interface Props {
  items: SettingsNavItem[];
  activeSection: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}

export default function SettingsTopNav({ items, activeSection, onSelect }: Props) {
  const theme = useTheme();

  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        No settings match your search.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        borderRadius: 2.5,
        border: '1px solid var(--border)',
        bgcolor: 'var(--bg-card)',
        px: { xs: 0.5, md: 1 },
        boxShadow: `0 2px 12px ${alpha(theme.palette.common.black, 0.04)}`,
      }}
    >
      <Tabs
        value={activeSection}
        onChange={(_, value: SettingsSectionId) => onSelect(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        ScrollButtonComponent={WrapTabScrollButton}
        sx={{
          minHeight: 48,
          '& .MuiTab-root': {
            minHeight: 48,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            px: { xs: 1.5, md: 2 },
            borderRadius: 2,
            mx: 0.25,
            my: 0.5,
            transition: 'background 0.15s ease',
          },
          '& .Mui-selected': {
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: theme.palette.primary.main,
          },
          '& .MuiTabs-indicator': {
            height: 3,
            borderRadius: '3px 3px 0 0',
          },
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Tab
              key={item.id}
              value={item.id}
              label={item.label}
              icon={<Icon sx={{ fontSize: 18 }} />}
              iconPosition="start"
            />
          );
        })}
      </Tabs>
    </Box>
  );
}
