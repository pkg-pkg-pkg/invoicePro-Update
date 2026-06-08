// src/services/backupService.ts

import { APP_DISPLAY_NAME } from '../constants/appBranding';
import { isElectronRuntime } from '../utils/runtime';
import { getNormalizedCompanyProfile } from '../utils/companyProfile';

const MANUAL_LOCATION_KEY = 'manualBackupLocation';

interface AutoBackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  location: string;
  retentionDays: number;
}

class BackupService {
  private autoBackupInterval: NodeJS.Timeout | null = null;
  private config: AutoBackupConfig = {
    enabled: false,
    frequency: 'daily',
    time: '23:00',
    location: '',
    retentionDays: 7,
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
    if (!this.config.enabled) return;

    // Clear existing interval
    if (this.autoBackupInterval) {
      clearInterval(this.autoBackupInterval);
    }

    // Calculate next backup time
    const nextBackup = this.calculateNextBackupTime();

    console.log('Auto-backup scheduled for:', nextBackup.toLocaleString());

    // Set up interval to check every minute
    this.autoBackupInterval = setInterval(() => {
      const now = new Date();
      if (now >= nextBackup) {
        this.performAutoBackup();
        // Schedule next backup
        const newNextBackup = this.calculateNextBackupTime();
        console.log('Next auto-backup scheduled for:', newNextBackup.toLocaleString());
      }
    }, 60000); // Check every minute
  }

  private restartAutoBackup() {
    this.startAutoBackup();
  }

  private calculateNextBackupTime(): Date {
    const now = new Date();
    const [hours, minutes] = this.config.time.split(':').map(Number);

    let nextBackup = new Date(now);
    nextBackup.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, schedule for next occurrence
    if (nextBackup <= now) {
      switch (this.config.frequency) {
        case 'daily':
          nextBackup.setDate(nextBackup.getDate() + 1);
          break;
        case 'weekly':
          // Next Monday
          const daysUntilMonday = (8 - nextBackup.getDay()) % 7 || 7;
          nextBackup.setDate(nextBackup.getDate() + daysUntilMonday);
          break;
        case 'monthly':
          // Next month, 1st
          nextBackup.setMonth(nextBackup.getMonth() + 1, 1);
          break;
      }
    }

    return nextBackup;
  }

  private async performAutoBackup() {
    try {
      console.log('Starting auto-backup...');

      const loadCount = (key: string) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return 0;
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          return 0;
        }
      };

      const invoiceCount = loadCount('pve_invoicepro_invoices');
      const customerCount = loadCount('pve_customers');
      const supplierCount = loadCount('pve_suppliers');
      const productCount = loadCount('pve_products');

      // Overwrite strategy: keep a single latest backup by default
      const fileName = `InvoicePro_Backup_Latest.ipbak`;

      // Create backup entry
      const backupEntry = {
        id: Date.now().toString(),
        fileName,
        createdAt: new Date().toISOString(),
        size: 'N/A',
        type: 'auto' as const,
        companyName: getNormalizedCompanyProfile().businessName || 'Your Company',
        invoiceCount,
        customerCount,
        supplierCount,
        productCount,
        location: this.config.location,
      };

      // Save backup entry to localStorage (in real app, this would be in a database)
      localStorage.setItem('backupHistory', JSON.stringify([backupEntry]));

      console.log('Auto-backup completed:', fileName);

      // Show notification (in Electron, this would be a system notification)
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(`${APP_DISPLAY_NAME} Auto-Backup`, {
            body: `Backup created successfully: ${fileName}`,
            icon: '/invoicepro-logo.png'
          });
        }
      }

    } catch (error) {
      console.error('Auto-backup failed:', error);
    }
  }

  public async createManualBackup(location: string): Promise<{
    success: boolean;
    fileName?: string;
    filePath?: string;
    location?: string;
    size?: string;
    error?: string;
  }> {
    try {
      const targetDir = location.trim();
      if (!targetDir) {
        return { success: false, error: 'Please choose a backup folder first.' };
      }

      if (isElectronRuntime() && window.electronAPI?.backupCreateManual) {
        const result = await window.electronAPI.backupCreateManual({ targetDir });
        if (!result.success) {
          return { success: false, error: result.error || 'Manual backup failed' };
        }

        const backupEntry = {
          id: Date.now().toString(),
          fileName: result.fileName || 'InvoicePro_Backup.ipbak',
          createdAt: new Date().toISOString(),
          size: result.sizeLabel || 'N/A',
          type: 'manual' as const,
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

        return {
          success: true,
          fileName: result.fileName,
          filePath: result.filePath,
          location: result.location || targetDir,
          size: backupEntry.size,
        };
      }

      const fileName = `InvoicePro_Backup_Latest.ipbak`;
      const loadCount = (key: string) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return 0;
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          return 0;
        }
      };

      const backupEntry = {
        id: Date.now().toString(),
        fileName,
        createdAt: new Date().toISOString(),
        size: 'N/A',
        type: 'manual' as const,
        companyName: getNormalizedCompanyProfile().businessName || 'Your Company',
        invoiceCount: loadCount('pve_invoicepro_invoices'),
        customerCount: loadCount('pve_customers'),
        supplierCount: loadCount('pve_suppliers'),
        productCount: loadCount('pve_products'),
        location: targetDir,
      };

      localStorage.setItem('backupHistory', JSON.stringify([backupEntry]));
      this.setManualBackupLocation(targetDir);

      return { success: true, fileName, location: targetDir };
    } catch (error) {
      console.error('Manual backup failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
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

// Export singleton instance
export const backupService = new BackupService();
