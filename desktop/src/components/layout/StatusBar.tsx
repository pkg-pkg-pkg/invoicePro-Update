import { Box } from '@mui/material';
import { useSyncStatus } from '../../hooks/useSyncStatus';

/** Cloud middleware sync indicator for the desktop status bar. */
export default function SyncStatusBar() {
  const { state, pendingCount, lastSyncedLabel } = useSyncStatus();

  let icon = '🔴';
  let label = 'Sync Off';

  switch (state) {
    case 'synced':
      icon = '🟢';
      label = lastSyncedLabel ? `Synced ${lastSyncedLabel}` : 'Synced';
      break;
    case 'pending':
      icon = '🟡';
      label = `Pending (${pendingCount})`;
      break;
    case 'syncing':
      icon = '🔵';
      label = 'Syncing...';
      break;
    case 'off':
    default:
      icon = '🔴';
      label = 'Sync Off';
  }

  return (
    <Box
      component="span"
      title={`Cloud sync: ${label}`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        mr: 1.5,
        fontSize: '0.6875rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <Box component="span" sx={{ fontSize: '0.5rem', lineHeight: 1 }}>
        {icon}
      </Box>
      {label}
    </Box>
  );
}
