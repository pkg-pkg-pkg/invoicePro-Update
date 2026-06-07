import { APP_VERSION } from '../constants/appBranding';
import { getAppSettings } from './appSettingsService';
import { backupService } from './backupService';
import { getWhatsAppConnectionStatus, refreshWhatsAppConnectionStatus } from './whatsappIntegration';
import { networkService } from './networkService';
import { isElectronRuntime } from '../utils/runtime';

export interface SettingsHealthSnapshot {
  databaseConnected: boolean;
  backupWorking: boolean;
  gstActive: boolean;
  whatsAppConnected: boolean;
  networkAvailable: boolean;
  version: string;
  lastSync: string;
}

export async function loadSettingsHealth(): Promise<SettingsHealthSnapshot> {
  let whatsAppConnected = getWhatsAppConnectionStatus().ok;
  try {
    const wa = await refreshWhatsAppConnectionStatus();
    whatsAppConnected = wa.ok;
  } catch {
    /* keep cached */
  }

  const history = backupService.getBackupHistory() as Array<{ date?: string; createdAt?: string }>;
  const lastBackup = history[0];
  const lastBackupTime = lastBackup?.date || lastBackup?.createdAt || '';

  const network = networkService.getStatus();
  const gstEnabled = Boolean(getAppSettings().features?.gstEnabled);

  return {
    databaseConnected: true,
    backupWorking: Boolean(lastBackupTime || backupService.getManualBackupLocation()),
    gstActive: gstEnabled,
    whatsAppConnected,
    networkAvailable: network.isEnabled || network.isServerRunning || Boolean(network.isClientConnected),
    version: APP_VERSION,
    lastSync: lastBackupTime
      ? new Date(lastBackupTime).toLocaleString()
      : isElectronRuntime()
        ? 'Not synced yet'
        : '—',
  };
}
