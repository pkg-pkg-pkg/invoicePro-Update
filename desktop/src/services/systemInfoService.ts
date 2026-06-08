import { financialYearLabel } from '../components/dashboard/dashboardTheme';
import { APP_DISPLAY_NAME, APP_VERSION } from '../constants/appBranding';
import { getActiveCompanyId } from '../utils/companyStorage';
import { isElectronRuntime } from '../utils/runtime';
import { getAppSettings } from './appSettingsService';
import { backupService } from './backupService';
import { refreshMultiUserLanInCache } from './licenseService';
import { networkService } from './networkService';
import { getNormalizedCompanyProfile } from '../utils/companyProfile';

export interface ElectronSystemInfo {
  appVersion?: string;
  applicationPath?: string;
  execPath?: string;
  userDataPath?: string;
  companyDataPath?: string;
  companyId?: string;
  companyName?: string;
  platform?: string;
  osLabel?: string;
  hostName?: string;
  totalMemoryGb?: number;
  arch?: string;
  error?: string;
}

export interface SystemInfoSnapshot {
  appName: string;
  appVersion: string;
  applicationPath: string;
  userDataPath: string;
  companyDataPath: string;
  companyId: string;
  companyName: string;
  financialYear: string;
  fyRange: string;
  backupFolder: string;
  lastBackupDate: string;
  lastBackupFile: string;
  licenseEdition: 'Gold' | 'Platinum' | 'Unknown';
  licenseKeyMasked: string;
  gatewayValidUntil: string;
  gatewayUpdatesEntitled: boolean;
  multiUserEnabled: boolean;
  multiUserRole: string;
  multiUserServerUrl: string;
  osLabel: string;
  hostName: string;
  totalMemoryGb: number | null;
  platform: string;
}

function maskLicenseKey(key: string | null | undefined): string {
  const k = String(key ?? '').trim();
  if (!k) return '—';
  if (k.length <= 8) return '****';
  return `${k.slice(0, 4)}****${k.slice(-4)}`;
}

function getCompanyDisplayName(): string {
  try {
    return String(getNormalizedCompanyProfile().businessName ?? '').trim();
  } catch {
    return '';
  }
}

function formatFyRange(): string {
  const fy = getAppSettings().financialYear;
  return `${fy.startDate} → ${fy.endDate}`;
}

export async function loadSystemInfoSnapshot(): Promise<SystemInfoSnapshot> {
  let electron: ElectronSystemInfo = {};
  if (isElectronRuntime() && window.electronAPI?.getAppSystemInfo) {
    electron = await window.electronAPI.getAppSystemInfo();
  }

  const license = await refreshMultiUserLanInCache().catch(() => ({
    multiUserLan: false,
    licenseKey: null as string | null,
    gatewayValidUntilMs: null as number | null,
    gatewayUpdatesEntitled: false,
  }));

  const network = networkService.getStatus();
  const history = backupService.getBackupHistory() as Array<{
    date?: string;
    fileName?: string;
    filePath?: string;
    location?: string;
  }>;
  const last = history[0];

  const companyName = electron.companyName || getCompanyDisplayName() || '—';

  const multiUserRole = network.isServerRunning
    ? 'Server'
    : network.isClientConnected
      ? 'Client'
      : network.isEnabled
        ? 'Enabled (idle)'
        : 'Off';

  return {
    appName: APP_DISPLAY_NAME,
    appVersion: electron.appVersion || APP_VERSION,
    applicationPath: electron.applicationPath || electron.execPath || '—',
    userDataPath: electron.userDataPath || '—',
    companyDataPath: electron.companyDataPath || '—',
    companyId: electron.companyId || getActiveCompanyId(),
    companyName,
    financialYear: financialYearLabel(),
    fyRange: formatFyRange(),
    backupFolder: backupService.getManualBackupLocation() || '—',
    lastBackupDate: last?.date ? String(last.date) : '—',
    lastBackupFile: last?.filePath || last?.fileName || '—',
    licenseEdition: license.multiUserLan ? 'Platinum' : license.licenseKey ? 'Gold' : 'Unknown',
    licenseKeyMasked: maskLicenseKey(license.licenseKey),
    gatewayValidUntil:
      license.gatewayValidUntilMs != null
        ? new Date(license.gatewayValidUntilMs).toLocaleString()
        : '—',
    gatewayUpdatesEntitled: license.gatewayUpdatesEntitled,
    multiUserEnabled: network.isEnabled,
    multiUserRole,
    multiUserServerUrl: network.serverUrl || '—',
    osLabel: electron.osLabel || navigator.platform || '—',
    hostName: electron.hostName || '—',
    totalMemoryGb: electron.totalMemoryGb ?? null,
    platform: electron.platform || '—',
  };
}
