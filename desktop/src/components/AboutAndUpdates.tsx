// src/components/AboutAndUpdates.tsx
import React, { useState, useEffect } from 'react';
import { refreshMultiUserLanInCache } from '../services/licenseService';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Grid,
  Divider,
  Stack,
} from '@mui/material';
import {
  SystemUpdate as UpdateIcon,
  Info as InfoIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  ContactSupport as ContactSupportIcon,
} from '@mui/icons-material';
import { APP_DISPLAY_NAME, APP_TAGLINE } from '../constants/appBranding';
import {
  checkForAppUpdate,
  fetchAppRelease,
  isOlderVersion,
  resolveDownloadUrl,
} from '../services/appUpdateService';
import { openExternalUrl } from '../services/printService';

function releaseNotesToChangelog(notes?: string): string[] | undefined {
  const text = String(notes ?? '').trim();
  if (!text) return undefined;
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  newVersion?: string;
  releaseNotes?: string;
  releaseDate?: string;
  changelog?: string[];
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  speed: number;
}

interface MobileSyncStatusResponse {
  token: string;
  localEndpoint: string;
  status: {
    running: boolean;
    publicUrl: string | null;
    tunnelConnected: boolean;
    pendingInboxCount: number;
    pendingOutboxCount: number;
    lastUploadAt: string | null;
    lastDownloadAt: string | null;
    lastError: string | null;
  } | null;
}

const AboutAndUpdates: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(
    localStorage.getItem('lastUpdateCheck')
  );
  const [gatewayUpdatesEntitled, setGatewayUpdatesEntitled] = useState<boolean>(true);
  const [gatewayValidUntilMs, setGatewayValidUntilMs] = useState<number | null>(null);
  const [mobileSyncInfo, setMobileSyncInfo] = useState<MobileSyncStatusResponse | null>(null);
  const [mobileSyncLoading, setMobileSyncLoading] = useState(false);

  const currentVersion =
    (typeof import.meta.env.VITE_APP_VERSION === 'string' && import.meta.env.VITE_APP_VERSION) || '1.0.0';

  useEffect(() => {
    // Listen for update events from electron main process
    const handleUpdateAvailable = (info: any) => {
      setUpdateInfo({
        updateAvailable: true,
        currentVersion,
        newVersion: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
      });
      setCheckingForUpdates(false);
    };

    const handleUpdateNotAvailable = (_info: any) => {
      setUpdateInfo({
        updateAvailable: false,
        currentVersion,
      });
      setCheckingForUpdates(false);
      setLastChecked(new Date().toLocaleString());
      localStorage.setItem('lastUpdateCheck', new Date().toISOString());
    };

    const handleDownloadProgress = (progress: DownloadProgress) => {
      setDownloadProgress(progress);
    };

    const handleUpdateDownloaded = (_info: any) => {
      setDownloading(false);
      setUpdateDownloaded(true);
    };

    const handleUpdateError = (error: { message: string }) => {
      setError(error.message);
      setCheckingForUpdates(false);
      setDownloading(false);
    };

    // Add event listeners
    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable(handleUpdateAvailable);
      window.electronAPI.onUpdateNotAvailable(handleUpdateNotAvailable);
      window.electronAPI.onDownloadProgress(handleDownloadProgress);
      window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded);
      window.electronAPI.onUpdateError(handleUpdateError);
    }

    return () => {
      // Cleanup listeners
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('update-available');
        window.electronAPI.removeAllListeners('update-not-available');
        window.electronAPI.removeAllListeners('download-progress');
        window.electronAPI.removeAllListeners('update-downloaded');
        window.electronAPI.removeAllListeners('update-error');
      }
    };
  }, [currentVersion]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await refreshMultiUserLanInCache();
        setGatewayUpdatesEntitled(r.gatewayUpdatesEntitled);
        setGatewayValidUntilMs(r.gatewayValidUntilMs);
      } catch {
        setGatewayUpdatesEntitled(true);
      }
    })();
  }, []);

  const loadMobileSyncStatus = async () => {
    if (!window.electronAPI?.mobileSyncStatus) return;
    setMobileSyncLoading(true);
    try {
      const info = await window.electronAPI.mobileSyncStatus();
      setMobileSyncInfo(info);
    } catch (err) {
      setError((err as Error)?.message || 'Failed to load mobile sync status');
    } finally {
      setMobileSyncLoading(false);
    }
  };

  useEffect(() => {
    void loadMobileSyncStatus();
    if (!window.electronAPI?.onMobileSyncStatus) return;
    window.electronAPI.onMobileSyncStatus((data: any) => {
      setMobileSyncInfo((prev) => ({
        token: prev?.token || '',
        localEndpoint: prev?.localEndpoint || '',
        status: data,
      }));
    });
  }, []);

  const handleCheckForUpdates = async () => {
    setCheckingForUpdates(true);
    setError(null);

    try {
      let info: UpdateInfo = {
        updateAvailable: false,
        currentVersion,
      };

      try {
        const pendingNotes = localStorage.getItem('pve_pending_release_notes');
        const pendingVersion = localStorage.getItem('pve_pending_update_version');
        if (pendingNotes) {
          info.releaseNotes = pendingNotes;
          info.changelog = releaseNotesToChangelog(pendingNotes);
          localStorage.removeItem('pve_pending_release_notes');
        }
        if (pendingVersion) {
          info.newVersion = pendingVersion;
          localStorage.removeItem('pve_pending_update_version');
        }
      } catch {
        // ignore
      }

      const cloud = await checkForAppUpdate();
      info = {
        updateAvailable: cloud.updateAvailable,
        currentVersion: cloud.currentVersion,
        newVersion: cloud.info?.latestVersion || info.newVersion,
        releaseNotes: cloud.info?.releaseNotes || info.releaseNotes,
        changelog:
          releaseNotesToChangelog(cloud.info?.releaseNotes) || info.changelog,
      };

      if (window.electronAPI?.checkForUpdates) {
        const electronResult = await window.electronAPI.checkForUpdates();
        const rawNotes = (electronResult as { releaseNotes?: unknown }).releaseNotes;
        const electronNotes =
          typeof rawNotes === 'string'
            ? rawNotes
            : Array.isArray(rawNotes)
              ? rawNotes.map(String).join('\n')
              : '';
        if (electronResult?.updateAvailable) {
          info = {
            updateAvailable: true,
            currentVersion: electronResult.currentVersion || info.currentVersion,
            newVersion: electronResult.newVersion || info.newVersion,
            releaseNotes: electronNotes || info.releaseNotes,
            changelog: releaseNotesToChangelog(electronNotes) || info.changelog,
            releaseDate: electronResult.releaseDate,
          };
        } else if (!cloud.updateAvailable) {
          info = {
            ...info,
            updateAvailable: false,
            currentVersion: electronResult?.currentVersion || info.currentVersion,
          };
        }
      }

      if (!info.changelog?.length) {
        const rel = await fetchAppRelease();
        if (rel?.releaseNotes) {
          info.releaseNotes = rel.releaseNotes;
          info.changelog = releaseNotesToChangelog(rel.releaseNotes);
        }
        if (
          rel &&
          isOlderVersion(info.currentVersion, rel.latestVersion) &&
          !info.updateAvailable
        ) {
          info = {
            ...info,
            updateAvailable: true,
            newVersion: rel.latestVersion,
          };
        }
      }

      setUpdateInfo(info);
      setLastChecked(new Date().toLocaleString());
      localStorage.setItem('lastUpdateCheck', new Date().toISOString());
    } catch (err: any) {
      setError(err.message || 'Failed to check for updates');
    } finally {
      setCheckingForUpdates(false);
    }
  };

  useEffect(() => {
    try {
      const flag = localStorage.getItem('auto_check_updates_once');
      if (flag === '1') {
        localStorage.removeItem('auto_check_updates_once');
        void handleCheckForUpdates();
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownloadUpdate = async () => {
    setDownloading(true);
    setDownloadProgress(null);
    setError(null);

    try {
      const r = await refreshMultiUserLanInCache();
      setGatewayUpdatesEntitled(r.gatewayUpdatesEntitled);
      setGatewayValidUntilMs(r.gatewayValidUntilMs);
      if (!r.gatewayUpdatesEntitled) {
        setError(
          'Gateway subscription expired. Renew in Settings → Network & Multi-User → Gateway validity to download updates.'
        );
        setDownloading(false);
        return;
      }
      if (window.electronAPI) {
        await window.electronAPI.downloadUpdate();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to download update');
      setDownloading(false);
    }
  };

  const handleInstallUpdate = () => {
    if (window.electronAPI) {
      window.electronAPI.installUpdate();
    }
  };

  const handleMobileSyncRetry = async () => {
    if (!window.electronAPI?.mobileSyncRetry) return;
    try {
      await window.electronAPI.mobileSyncRetry();
      await loadMobileSyncStatus();
    } catch (err) {
      setError((err as Error)?.message || 'Failed to retry mobile sync');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        About {APP_DISPLAY_NAME}
      </Typography>

            <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <InfoIcon sx={{ mr: 1 }} />
              Software Information
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Current Version
              </Typography>
              <Typography variant="h6" color="primary">
                v{currentVersion}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Last Update Check
              </Typography>
              <Typography variant="body2">
                {lastChecked || 'Never'}
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {APP_DISPLAY_NAME} — {APP_TAGLINE}; professional invoice and billing management.
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Contact Information
            </Typography>

            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Email
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                pve.2020@hotmail.com
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Mobile
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                +91 75490 30630
              </Typography>
            </Box>

            <Typography variant="body2" sx={{ mt: 2, p: 2, bgcolor: 'info.main', color: 'info.contrastText', borderRadius: 1 }}>
              📧 For updates, issues, or customization requests, please email us first.
              <br />
              💰 Charges apply for customizations. Minimum charge: ₹6,000.00
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <UpdateIcon sx={{ mr: 1 }} />
              Software Updates
            </Typography>

            {gatewayValidUntilMs != null && (
              <Alert severity={gatewayUpdatesEntitled ? 'info' : 'warning'} sx={{ mb: 2 }}>
                <strong>Gateway (updates)</strong> valid until{' '}
                {new Date(gatewayValidUntilMs).toLocaleString()}
                {!gatewayUpdatesEntitled && (
                  <>
                    <br />
                    Renew under Settings → Network &amp; Multi-User to enable update downloads.
                  </>
                )}
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {updateInfo?.updateAvailable && !downloading && !updateDownloaded && (
              <Alert severity="success" sx={{ mb: 2 }}>
                🎉 Update Available! Version {updateInfo.newVersion} is ready to download.
              </Alert>
            )}

            {downloading && downloadProgress && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Downloading Update... {Math.round(downloadProgress.percent)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={downloadProgress.percent}
                  sx={{ mb: 1 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
                  {' • '}
                  {formatSpeed(downloadProgress.speed)}
                </Typography>
              </Box>
            )}

            {updateDownloaded && (
              <Alert severity="success" sx={{ mb: 2 }}>
                ✅ Update downloaded successfully! Ready to install.
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={handleCheckForUpdates}
                disabled={checkingForUpdates || downloading}
                startIcon={checkingForUpdates ? undefined : <UpdateIcon />}
              >
                {checkingForUpdates ? 'Checking...' : 'Check for Updates'}
              </Button>

              {updateInfo?.updateAvailable && !downloading && !updateDownloaded && (
                <Button
                  variant="contained"
                  onClick={handleDownloadUpdate}
                  startIcon={<DownloadIcon />}
                  disabled={!gatewayUpdatesEntitled}
                >
                  Download Update
                </Button>
              )}

              {updateDownloaded && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleInstallUpdate}
                  startIcon={<CheckCircleIcon />}
                >
                  Install & Restart
                </Button>
              )}
            </Box>

            {updateInfo && !updateInfo.updateAvailable && !checkingForUpdates && !updateInfo.changelog?.length && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                ℹ️ You are using the latest version
              </Typography>
            )}
          </Paper>
        </Grid>

        {updateInfo?.updateAvailable && updateInfo?.changelog && updateInfo.changelog.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                What's New in v{updateInfo.newVersion}
              </Typography>
              <List dense>
                {updateInfo.changelog.map((item, index) => (
                  <ListItem key={index}>
                    <ListItemText primary={`• ${item}`} />
                  </ListItem>
                ))}
              </List>
              {updateInfo.releaseDate && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Release Date: {new Date(updateInfo.releaseDate).toLocaleDateString()}
                </Typography>
              )}
            </Paper>
          </Grid>
        )}

        {/* Support & Contact Information */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <ContactSupportIcon sx={{ mr: 1 }} />
              Support & Contact
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    📧 Email Support
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    pve.2020@hotmail.com
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    For updates, technical issues, or customization requests
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    📱 Mobile Support
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    +91 75490 30630
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    WhatsApp or direct call for urgent support
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    💰 Customization Services
                  </Typography>
                  <Typography variant="body2">
                    Need custom features or modifications? Contact us via email for requirements and pricing.
                    <br />
                    <strong>Minimum customization charge: ₹6,000.00</strong>
                    <br />
                    Additional charges apply based on complexity and requirements.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <ContactSupportIcon sx={{ mr: 1 }} />
              Mobile Sync Middleware
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Desktop embedded middleware status and manual retry controls.
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Local Endpoint"
                  secondary={mobileSyncInfo?.localEndpoint || 'Not available'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Public Endpoint"
                  secondary={mobileSyncInfo?.status?.publicUrl || 'Tunnel not connected'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Sync Token"
                  secondary={mobileSyncInfo?.token || 'Not generated'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Queue"
                  secondary={`Inbox pending: ${mobileSyncInfo?.status?.pendingInboxCount || 0}, Outbox pending: ${mobileSyncInfo?.status?.pendingOutboxCount || 0}`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Last Activity"
                  secondary={`Upload: ${mobileSyncInfo?.status?.lastUploadAt || '-'} | Download: ${mobileSyncInfo?.status?.lastDownloadAt || '-'}`}
                />
              </ListItem>
            </List>
            {mobileSyncInfo?.status?.lastError && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {mobileSyncInfo.status.lastError}
              </Alert>
            )}
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={loadMobileSyncStatus} disabled={mobileSyncLoading}>
                Refresh status
              </Button>
              <Button variant="contained" onClick={handleMobileSyncRetry}>
                Retry now
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AboutAndUpdates;
