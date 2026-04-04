// src/services/networkService.ts
// Basic network service for multi-user functionality

import { isTauriRuntime } from '../utils/runtime';

export interface NetworkConfig {
  enabled: boolean;
  port: number;
  isServer: boolean;
  serverUrl?: string;
}

export interface ConnectedUser {
  id: string;
  name: string;
  role: string;
  ip: string;
  connectedAt: Date;
}

export interface NetworkStatus {
  isEnabled: boolean;
  isServerRunning: boolean;
  isClientConnected?: boolean;
  serverUrl?: string;
  connectedUsers: ConnectedUser[];
  localIP?: string;
}

class NetworkService {
  private config: NetworkConfig = {
    enabled: false,
    port: 3000,
    isServer: false,
  };

  private status: NetworkStatus = {
    isEnabled: false,
    isServerRunning: false,
    isClientConnected: false,
    connectedUsers: [],
  };

  private notifyConfigChanged(): void {
    try {
      window.dispatchEvent(new Event('networkConfigUpdated'));
    } catch {
      // ignore
    }
  }

  private async checkHost(serverUrl: string): Promise<boolean> {
    const base = serverUrl.replace(/\/+$/, '');
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${base}/api/license/status`, { signal: controller.signal });
      if (!res.ok) return false;
      const data: any = await res.json().catch(() => null);
      return !!data?.licensed;
    } catch {
      return false;
    } finally {
      window.clearTimeout(t);
    }
  }

  // Get current network status
  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  // Enable/disable multi-user mode
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.status.isEnabled = enabled;

    // Save to localStorage
    localStorage.setItem('network_config', JSON.stringify(this.config));
    this.notifyConfigChanged();
  }

  // Start server mode
  async startServer(): Promise<boolean> {
    if (!this.config.enabled) {
      throw new Error('Multi-user mode must be enabled first');
    }

    try {
      if (isTauriRuntime()) {
        const mod: any = await import('@tauri-apps/api/core');
        const res = await mod.invoke('start_host_server', { port: this.config.port });
        this.config.isServer = true;
        this.status.isServerRunning = true;
        this.status.isClientConnected = false;
        this.status.serverUrl = (res as any)?.server_url ?? (res as any)?.serverUrl ?? `http://localhost:${this.config.port}`;
        this.status.localIP = (res as any)?.local_ip ?? (res as any)?.localIp;
      } else {
        // Browser runtime: simulate
        this.config.isServer = true;
        this.status.isServerRunning = true;
        this.status.isClientConnected = false;
        this.status.serverUrl = `http://localhost:${this.config.port}`;
        this.status.localIP = '192.168.1.100';
      }

      // Save config
      localStorage.setItem('network_config', JSON.stringify(this.config));
      this.notifyConfigChanged();

      return true;
    } catch (error) {
      console.error('Failed to start server:', error);
      return false;
    }
  }

  // Stop server mode
  async stopServer(): Promise<boolean> {
    try {
      if (isTauriRuntime()) {
        const mod: any = await import('@tauri-apps/api/core');
        await mod.invoke('stop_host_server');
      }

      this.config.isServer = false;
      this.status.isServerRunning = false;
      this.status.isClientConnected = false;
      this.status.serverUrl = undefined;
      this.status.connectedUsers = [];

      // Save config
      localStorage.setItem('network_config', JSON.stringify(this.config));
      this.notifyConfigChanged();

      return true;
    } catch (error) {
      console.error('Failed to stop server:', error);
      return false;
    }
  }

  // Connect to server
  async connectToServer(serverUrl: string): Promise<boolean> {
    try {
      const ok = await this.checkHost(serverUrl);
      if (!ok) {
        this.status.isClientConnected = false;
        return false;
      }

      this.config.serverUrl = serverUrl;
      this.config.isServer = false;
      this.status.serverUrl = serverUrl;
      this.status.isClientConnected = true;

      // Save config
      localStorage.setItem('network_config', JSON.stringify(this.config));
      this.notifyConfigChanged();

      return true;
    } catch (error) {
      console.error('Failed to connect to server:', error);
      this.status.isClientConnected = false;
      return false;
    }
  }

  // Disconnect from server
  async disconnect(): Promise<boolean> {
    try {
      this.config.serverUrl = undefined;
      this.status.serverUrl = undefined;
      this.status.isClientConnected = false;

      // Save config
      localStorage.setItem('network_config', JSON.stringify(this.config));
      this.notifyConfigChanged();

      return true;
    } catch (error) {
      console.error('Failed to disconnect:', error);
      return false;
    }
  }

  // Load configuration from localStorage
  loadConfig(): void {
    try {
      const saved = localStorage.getItem('network_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed };
        this.status.isEnabled = this.config.enabled;
        this.status.isServerRunning = this.config.isServer;
        this.status.serverUrl = this.config.serverUrl;
        this.status.isClientConnected = !!this.config.enabled && !this.config.isServer && !!this.config.serverUrl;
      }
    } catch (error) {
      console.warn('Failed to load network config:', error);
    }
  }

  // Initialize service
  init(): void {
    this.loadConfig();
  }
}

// Export singleton instance
export const networkService = new NetworkService();

// Initialize on import
networkService.init();
