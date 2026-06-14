import { Button, Stack } from '@mui/material';
import { drainQueue } from '../../services/sync/syncQueueDrain';
import { syncElectronStore } from '../../services/sync/syncElectronStore';

type Props = {
  onRefresh: () => void;
  onCopyReport: () => void;
};

export function SuperAdminActions({ onRefresh, onCopyReport }: Props) {
  const forceSync = async () => {
    await drainQueue();
    onRefresh();
  };

  const clearQueue = async () => {
    await syncElectronStore.setDeltaQueue([]);
    onRefresh();
  };

  const resetToken = async () => {
    await syncElectronStore.setJwtToken('');
    onRefresh();
  };

  const backupNow = async () => {
    const dir = await window.electronAPI?.dialogPickFolder?.({ title: 'Backup folder' });
    if (!dir) return;
    await window.electronAPI?.backupCreateManual?.({ targetDir: dir });
    onRefresh();
  };

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Button size="small" variant="contained" onClick={() => void forceSync()}>
        Force Sync
      </Button>
      <Button size="small" variant="outlined" onClick={() => void clearQueue()}>
        Clear Queue
      </Button>
      <Button size="small" variant="outlined" onClick={() => void resetToken()}>
        Reset Token
      </Button>
      <Button size="small" variant="outlined" onClick={() => void backupNow()}>
        Backup DB
      </Button>
      <Button size="small" variant="outlined" onClick={() => void window.electronAPI?.superAdminOpenDbFolder?.()}>
        Open DB Folder
      </Button>
      <Button size="small" variant="outlined" onClick={() => void window.electronAPI?.superAdminOpenLogFolder?.()}>
        Open Log Folder
      </Button>
      <Button size="small" variant="outlined" onClick={onCopyReport}>
        Copy Report
      </Button>
      <Button size="small" color="error" variant="outlined" onClick={() => void window.electronAPI?.superAdminRelaunch?.()}>
        Restart App
      </Button>
    </Stack>
  );
}
