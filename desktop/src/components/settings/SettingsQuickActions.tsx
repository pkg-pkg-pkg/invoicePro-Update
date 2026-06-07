import React from 'react';
import { Box, Grid, Typography, alpha, useTheme } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/Restore';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import BusinessIcon from '@mui/icons-material/Business';

interface QuickAction {
  id: string;
  label: string;
  icon: SvgIconComponent;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}

interface Props {
  onBackupNow: () => void;
  onRestore: () => void;
  onWhatsApp: () => void;
  onAddUser: () => void;
  onCompanyProfile: () => void;
  canBackup?: boolean;
  canRestore?: boolean;
  canManageUsers?: boolean;
}

export default function SettingsQuickActions({
  onBackupNow,
  onRestore,
  onWhatsApp,
  onAddUser,
  onCompanyProfile,
  canBackup = true,
  canRestore = true,
  canManageUsers = true,
}: Props) {
  const theme = useTheme();

  const actions: QuickAction[] = [
    { id: 'backup', label: 'Backup Now', icon: BackupIcon, color: theme.palette.primary.main, onClick: onBackupNow, disabled: !canBackup },
    { id: 'restore', label: 'Restore', icon: RestoreIcon, color: theme.palette.warning.main, onClick: onRestore, disabled: !canRestore },
    { id: 'whatsapp', label: 'WhatsApp', icon: WhatsAppIcon, color: '#25D366', onClick: onWhatsApp },
    { id: 'user', label: 'Add User', icon: PersonAddIcon, color: theme.palette.secondary.main, onClick: onAddUser, disabled: !canManageUsers },
    { id: 'company', label: 'Company', icon: BusinessIcon, color: theme.palette.info.main, onClick: onCompanyProfile },
  ];

  return (
    <Grid container spacing={1.25}>
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Grid item xs={6} sm={4} md key={a.id}>
            <Box
              component="button"
              type="button"
              disabled={a.disabled}
              onClick={a.onClick}
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                px: 1,
                py: 1.5,
                border: '1px solid',
                borderColor: alpha(a.color, 0.22),
                borderRadius: 2.5,
                bgcolor: alpha(a.color, 0.05),
                cursor: a.disabled ? 'not-allowed' : 'pointer',
                opacity: a.disabled ? 0.45 : 1,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                '&:hover:not(:disabled)': {
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 12px ${alpha(a.color, 0.18)}`,
                  bgcolor: alpha(a.color, 0.1),
                },
              }}
            >
              <Icon sx={{ fontSize: 22, color: a.color }} />
              <Typography variant="caption" fontWeight={700} textAlign="center" lineHeight={1.2}>
                {a.label}
              </Typography>
            </Box>
          </Grid>
        );
      })}
    </Grid>
  );
}
