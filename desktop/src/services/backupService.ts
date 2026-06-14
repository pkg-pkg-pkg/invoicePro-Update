// src/services/backupService.ts

import { APP_DISPLAY_NAME } from '../constants/appBranding';
import { isElectronRuntime } from '../utils/runtime';
import { getNormalizedCompanyProfile } from '../utils/companyProfile';
import { trackFeatureUsage } from './privacy/featureAnalyticsService';

const MANUAL_LOCATION_KEY = 'manualBackupLocation';
const BACKUP_DESTINATION_KEY = 'backupDestinationConfig';

export type BackupDestination = 'local' | 'googleDrive' | 'firebase';

interface AutoBackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  location: string;
  retentionDays: number;
  destination: BackupDestination;
}

interface BackupDestinationConfig {
  local: boolean;
  googleDrive: boolean;
  firebase: boolean;
}

class BackupService {
  private autoBackupInterval: NodeJS.Timeout | null = null;
  private lastAutoBackupKey = 'lastAutoBackupAt';
  private config: AutoBackupConfig = {
    enabled: false,
    frequency: 'daily',
    time: '23:00',
    location: '',
    retentionDays: 7,
    destination: 'local',
  };

  constructor() {
    this.loadConfig();
    this.startAutoBackup();
  }

  private loadConfig() {
    try {
      const saved = localStorage.getItem('autoBackupConfig');
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Failed to load auto-backup config:', error);
    }
  }

  private saveConfig() {
    localStorage.setItem('autoBackupConfig', JSON.stringify(this.config));
  }

  public updateConfig(newConfig: Partial<AutoBackupConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    this.restartAutoBackup();
  }

  public getDestinationConfig(): BackupDestinationConfig {
    try {
      const raw = localStorage.getItem(BACKUP_DESTINATION_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return { local: true, googleDrive: false, firebase: false };
  }

  public setDestinationConfig(config: BackupDestinationConfig) {
    localStorage.setItem(BACKUP_DESTINATION_KEY, JSON.stringify(config));
    this.updateConfig({
      destination: config.local ? 'local' : config.googleDrive ? 'googleDrive' : 'firebase',
    });
  }

  public getManualBackupLocation(): string {
    try {
      const saved = localStorage.getItem(MANUAL_LOCATION_KEY);
      if (saved?.trim()) return saved.trim();
    } catch {
      /* ignore */
    }
    return this.config.location || '';
  }

  public setManualBackupLocation(location: string) {
    const trimmed = location.trim();
    try {
      if (trimmed) localStorage.setItem(MANUAL_LOCATION_KEY, trimmed);
      else localStorage.removeItem(MANUAL_LOCATION_KEY);
    } catch {
      /* ignore */
    }
    this.updateConfig({ location: trimmed });
  }

  public getConfig(): AutoBackupConfig {
    return { ...this.config };
  }

  private startAutoBackup() {
    if (!this.autoBackupInterval) {
      this.autoBackupInterval = setInterval(() => {
        void this.checkAndRunAutoBackup();
      }, 60000);
    }
  }

  private restartAutoBackup() {
    this.startAutoBackup();
  }

  private calculateNextBackupTime(): Date {
    const now = new Date();
    const [hours, minutes] = this.config.time.split(':').map(Number);

    let nextBackup = new Date(now);
    nextBackup.setHours(hours, minutes, 0, 0);

    if (nextBackup <= now) {
      switch (this.config.frequency) {
        case 'daily':
          nextBackup.setDate(nextBackup.getDate() + 1);
          break;
        case 'weekly': {
          const daysUntilMonday = (8 - nextBackup.getDay()) % 7 || 7;
          nextBackup.setDate(nextBackup.getDate() + daysUntilMonday);
          break;
        }
        case 'monthly':
          nextBackup.setMonth(nextBackup.getMonth() + 1, 1);
          break;
      }
    }

    return nextBackup;
  }

  private shouldRunAutoBackup(now: Date): boolean {
    if (!this.config.enabled) return false;
    const next = this.calculateNextBackupTime();
    if (now < next) return false;

    const lastRaw = localStorage.getItem(this.lastAutoBackupKey);
    if (!lastRaw) return true;
    const last = new Date(lastRaw);
    const msSince = now.getTime() - last.getTime();
    if (this.config.frequency === 'daily') return msSince >= 20 * 60 * 60 * 1000;
    if (this.config.frequency === 'weekly') return msSince >= 6 * 24 * 60 * 60 * 1000;
    return msSince >= 25 * 24 * 60 * 60 * 1000;
  }

  private async checkAndRunAutoBackup() {
    const now = new Date();
    if (!this.shouldRunAutoBackup(now)) return;
    await this.performAutoBackup();
  }

  private async performAutoBackup() {
    const dest = this.getDestinationConfig();
    if (!dest.local) {
      console.log('[backup] Auto-backup skipped — only local folder is active (cloud destinations are future-ready).');
      return;
    }

    const location = this.getManualBackupLocation();
    if (!location) {
      console.warn('[backup] Auto-backup skipped — no backup folder configured.');
      return;
    }

    const result = await this.createManualBackup(location, 'auto');
    if (!result.success) {
      if (result.requiresDatabaseConfirmation) {
        console.warn('[backup] Auto-backup skipped — database exceeds 80 MB inline limit.');
      }
      return;
    }
    localStorage.setItem(this.lastAutoBackupKey, new Date().toISOString());
    this.enforceRetention(location);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`${APP_DISPLAY_NAME} Auto-Backup`, {
        body: `Backup created: ${result.fileName || 'InvoicePro_Backup.ipbak'}`,
      });
    }
  }

  private enforceRetention(location: string) {
    const history = this.getBackupHistory().filter(
      (b: { location?: string }) => b.location === location || !b.location
    );
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
    const kept = history.filter((b: { createdAt: string }) => new Date(b.createdAt).getTime() >= cutoff);
    localStorage.setItem('backupHistory', JSON.stringify(kept.slice(0, 20)));
  }

  public async createManualBackup(
    location: string,
    type: 'manual' | 'auto' = 'manual',
    options?: { allowSkipDatabase?: boolean }
  ): Promise<{
    success: boolean;
    fileName?: string;
    filePath?: string;
    location?: string;
    size?: string;
    error?: string;
    partial?: boolean;
    databaseSkipped?: boolean;
    warning?: string;
    requiresDatabaseConfirmation?: boolean;
    dbSizeBytes?: number;
    dbSizeLabel?: string;
  }> {
    try {
      const targetDir = location.trim();
      if (!targetDir) {
        return { success: false, error: 'Please choose a backup folder first.' };
      }

      if (isElectronRuntime() && window.electronAPI?.backupCreateManual) {
        const result = await window.electronAPI.backupCreateManual({
          targetDir,
          allowSkipDatabase: options?.allowSkipDatabase,
        });
        if (result.requiresDatabaseConfirmation) {
          return {
            success: false,
            requiresDatabaseConfirmation: true,
            dbSizeBytes: result.dbSizeBytes,
            dbSizeLabel: result.dbSizeLabel,
            error: result.error || 'Database exceeds the 80 MB inline backup limit.',
          };
        }
        if (!result.success) {
          return { success: false, error: result.error || 'Manual backup failed' };
        }

        const backupEntry = {
          id: Date.now().toString(),
          fileName: result.fileName || 'InvoicePro_Backup.ipbak',
          createdAt: new Date().toISOString(),
          size: result.sizeLabel || 'N/A',
          type,
          companyName: getNormalizedCompanyProfile().businessName || 'Your Company',
          invoiceCount: 0,
          customerCount: 0,
          supplierCount: 0,
          productCount: 0,
          location: result.location || targetDir,
          filePath: result.filePath,
        };

        const history = this.getBackupHistory();
        history.unshift(backupEntry);
        localStorage.setItem('backupHistory', JSON.stringify(history.slice(0, 20)));
        this.setManualBackupLocation(result.location || targetDir);
        trackFeatureUsage('backupCreated');

        return {
          success: true,
          fileName: result.fileName,
          filePath: result.filePath,
          location: result.location || targetDir,
          size: backupEntry.size,
          partial: result.partial,
          databaseSkipped: result.databaseSkipped,
          warning: result.warning,
        };
      }

      return { success: false, error: 'Backup requires the desktop app.' };
    } catch (error) {
      console.error('Manual backup failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  public async previewBackupFile(filePath: string) {
    if (!isElectronRuntime() || !window.electronAPI?.backupPreviewFile) {
      return { success: false, error: 'Preview requires the desktop app.' };
    }
    return window.electronAPI.backupPreviewFile({ filePath });
  }

  public async restoreBackupFile(filePath: string) {
    if (!isElectronRuntime() || !window.electronAPI?.backupRestoreFromFile) {
      return { success: false, error: 'Restore requires the desktop app.' };
    }
    const { auditService } = await import('./audit/auditService');
    const result = await window.electronAPI.backupRestoreFromFile({ filePath });
    if (result?.success) {
      trackFeatureUsage('restorePerformed');
      await auditService.logBackupRestore(filePath, {
        restoredSections: result.restoredSections,
        restorePointId: result.restorePointId,
      });
      const { billReferenceService } = await import('./settlement/billReferenceService');
      await billReferenceService.ensureMigrated();
      await billReferenceService.runSettlementAuditAfterChange('restore');
    }
    return result;
  }

  public async rollbackRestorePoint(restorePointId: string) {
    if (!isElectronRuntime() || !window.electronAPI?.backupRollbackRestorePoint) {
      return { success: false, error: 'Rollback requires the desktop app.' };
    }
    return window.electronAPI.backupRollbackRestorePoint({ restorePointId });
  }

  public getBackupHistory() {
    try {
      return JSON.parse(localStorage.getItem('backupHistory') || '[]');
    } catch (error) {
      console.error('Failed to load backup history:', error);
      return [];
    }
  }

  public stop() {
    if (this.autoBackupInterval) {
      clearInterval(this.autoBackupInterval);
      this.autoBackupInterval = null;
    }
  }
}

export const backupService = new BackupService();
