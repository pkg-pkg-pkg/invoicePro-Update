import React from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography, alpha, useTheme } from '@mui/material';
import type { SettingsNavItem, SettingsSectionId } from './settingsNavConfig';

interface Props {
  items: SettingsNavItem[];
  activeSection: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}

export default function SettingsSidebar({ items, activeSection, onSelect }: Props) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: '1px solid var(--border)',
        bgcolor: 'var(--bg-card)',
        overflow: 'hidden',
        boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.04)}`,
      }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid var(--border)' }}>
        <Typography variant="subtitle2" fontWeight={800} color="text.secondary">
          SETTINGS
        </Typography>
      </Box>
      <List dense disablePadding sx={{ py: 0.5 }}>
        {items.map((item) => {
          const active = item.id === activeSection;
          const Icon = item.icon;
          return (
            <ListItemButton
              key={item.id}
              selected={active}
              onClick={() => onSelect(item.id)}
              sx={{
                mx: 1,
                my: 0.35,
                borderRadius: 2,
                transition: 'all 0.18s ease',
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  borderLeft: `3px solid ${theme.palette.primary.main}`,
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
                },
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  transform: 'translateX(2px)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Icon fontSize="small" color={active ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary={`${item.emoji} ${item.label}`}
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: active ? 700 : 500 }}
              />
            </ListItemButton>
          );
        })}
        {items.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No settings match your search.
          </Typography>
        )}
      </List>
    </Box>
  );
}
