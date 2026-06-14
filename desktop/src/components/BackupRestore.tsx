import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Backup as BackupIcon,
  Restore as RestoreIcon,
  Folder as FolderIcon,
  Schedule as ScheduleIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { backupService } from '../services/backupService';
import { pickBackupFile, pickBackupFolder, revealPathInFolder } from '../services/fileDialogService';
import { isElectronRuntime } from '../utils/runtime';

interface BackupInfo {
  id: string;
  fileName: string;
  createdAt: string;
  size: string;
  type: 'manual' | 'auto';
  companyName: string;
  invoiceCount: number;
  customerCount: number;
  supplierCount: number;
  productCount: number;
  location: string;
  filePath?: string;
}

interface BackupStats {
  totalBackups: number;
  totalSize: string;
  lastBackup: string;
  autoBackupEnabled: boolean;
  autoBackupFrequency: 'daily' | 'weekly' | 'monthly';
  autoBackupTime: string;
  retentionDays: number;
}

const BackupRestore: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [backupLocation, setBackupLocation] = useState('');
  const [backupFile, setBackupFile] = useState('');
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showAutoBackupDialog, setShowAutoBackupDialog] = useState(false);
  const [showBackupInfo, setShowBackupInfo] = useState<BackupInfo | null>(null);
  const [confirmRestore, setConfirmRestore] = useState('');
  const [showLargeDbDialog, setShowLargeDbDialog] = useState(false);
  const [largeDbMeta, setLargeDbMeta] = useState<{ dbSizeLabel?: string; error?: string } | null>(null);
  const [backupWarning, setBackupWarning] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<{
    companyName?: string;
    createdAt?: string;
    sections?: string[];
    hasDatabase?: boolean;
    databaseSkipped?: boolean;
    restoreWarnings?: string[];
  } | null>(null);
  const [destinations, setDestinations] = useState({
    local: true,
    googleDrive: false,
    firebase: false,
  });
  const [stats, setStats] = useState<BackupStats>({
    totalBackups: 0,
    totalSize: 'N/A',
    lastBackup: '',
    autoBackupEnabled: false,
    autoBackupFrequency: 'daily',
    autoBackupTime: '23:00',
    retentionDays: 7,
  });

  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load backup history on component mount
  useEffect(() => {
    const rows = backupService.getBackupHistory();
    setBackups(rows);
    setBackupLocation(backupService.getManualBackupLocation());
    setStats((prev) => ({
      ...prev,
      totalBackups: rows.length,
      lastBackup: rows[0]?.createdAt ?? prev.lastBackup,
    }));
  }, []);

  const finishBackupSuccess = (result: {
    fileName?: string;
    filePath?: string;
    location?: string;
    size?: string;
    partial?: boolean;
    databaseSkipped?: boolean;
    warning?: string;
  }) => {
    const rows = backupService.getBackupHistory();
    setBackups(rows);
    setStats(prev => ({
      ...prev,
      totalBackups: rows.length,
      lastBackup: new Date().toISOString(),
      totalSize: result.size ?? prev.totalSize,
    }));
    if (result.filePath) {
      setBackupFile(result.filePath);
    }
    if (result.partial || result.databaseSkipped) {
      setBackupWarning(
        result.warning ||
          'Backup created without the SQLite database. Restore will not recover vouchers or inventory from the database.'
      );
    } else {
      setBackupWarning(null);
    }
  };

  const runManualBackup = async (allowSkipDatabase?: boolean) => {
    setActionError(null);
    setLoading(true);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      const result = await backupService.createManualBackup(backupLocation, 'manual', {
        allowSkipDatabase,
      });

      clearInterval(progressInterval);
      setProgress(100);
      setLoading(false);

      if (result.requiresDatabaseConfirmation) {
        setProgress(0);
        setLargeDbMeta({
          dbSizeLabel: result.dbSizeLabel,
          error: result.error,
        });
        setShowLargeDbDialog(true);
        return;
      }

      if (result.success) {
        finishBackupSuccess(result);
      } else {
        setActionError(result.error || 'Backup failed');
        setProgress(0);
      }
    } catch (error) {
      setLoading(false);
      setProgress(0);
      setActionError(String(error));
    }
  };

  const handleCreateBackup = async () => {
    if (!backupLocation.trim()) {
      setActionError('Choose a backup folder before creating a manual backup.');
      return;
    }
    await runManualBackup();
  };

  const handleContinueWithoutDatabase = async () => {
    setShowLargeDbDialog(false);
    await runManualBackup(true);
  };

  const handleBrowseBackupFile = async () => {
    setActionError(null);
    setRestorePreview(null);
    const picked = await pickBackupFile({
      title: 'Select backup file (.ipbak)',
      defaultPath: backupFile || backupLocation || undefined,
    });
    if (picked) {
      setBackupFile(picked);
      const preview = await backupService.previewBackupFile(picked);
      if (preview.success && preview.meta) {
        setRestorePreview(preview.meta);
      } else if (preview.error) {
        setActionError(preview.error);
      }
      return;
    }
    if (!isElectronRuntime()) {
      setActionError('Use the desktop app to browse for backup files.');
    }
  };

  const handleChangeBackupLocation = async () => {
    setActionError(null);
    const picked = await pickBackupFolder({
      title: 'Choose folder to save backups',
      defaultPath: backupLocation || undefined,
    });
    if (picked) {
      setBackupLocation(picked);
      backupService.setManualBackupLocation(picked);
      return;
    }
    if (!isElectronRuntime()) {
      setActionError('Use the desktop app to choose a custom backup folder.');
    }
  };

  const handleRestoreBackup = async () => {
    if (confirmRestore !== 'RESTORE' || !backupFile.trim()) return;

    setLoading(true);
    setProgress(10);
    setActionError(null);

    try {
      setProgress(40);
      const result = await backupService.restoreBackupFile(backupFile);
      setProgress(100);
      setLoading(false);
      setShowRestoreDialog(false);
      setConfirmRestore('');

      if (!result.success) {
        setActionError(result.error || 'Restore failed');
        setProgress(0);
        return;
      }

      const sections = (result.restoredSections || []).join(', ') || 'company data';
      const reload = window.confirm(
        `Backup restored successfully (${sections}). The app must restart to load restored data. Restart now?`
      );
      if (reload) {
        window.location.reload();
      }
    } catch (error) {
      setLoading(false);
      setProgress(0);
      setActionError(String(error));
    }
  };

  const handleDeleteBackup = (backupId: string) => {
    if (confirm('Are you sure you want to delete this backup?')) {
      setBackups(prev => prev.filter(b => b.id !== backupId));
      setStats(prev => ({
        ...prev,
        totalBackups: prev.totalBackups - 1,
      }));
    }
  };

  const handleSaveAutoBackupSettings = () => {
    backupService.setDestinationConfig(destinations);
    backupService.updateConfig({
      enabled: stats.autoBackupEnabled,
      frequency: stats.autoBackupFrequency,
      time: stats.autoBackupTime,
      retentionDays: stats.retentionDays,
    });
    setShowAutoBackupDialog(false);
  };

  // Load auto-backup config on mount
  useEffect(() => {
    const config = backupService.getConfig();
    setDestinations(backupService.getDestinationConfig());
    setStats(prev => ({
      ...prev,
      autoBackupEnabled: config.enabled,
      autoBackupFrequency: config.frequency,
      autoBackupTime: config.time,
      retentionDays: config.retentionDays,
    }));
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Backup & Restore
      </Typography>

      <Typography variant="h6" gutterBottom>
        Backup & Restore
      </Typography>

      {backupWarning ? (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setBackupWarning(null)}>
          {backupWarning}
        </Alert>
      ) : null}

      {actionError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      <Grid container spacing={3}>
        {/* Manual Backup Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <BackupIcon sx={{ mr: 1 }} />
              Manual Backup
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Saves companies, masters, inventory, vouchers, and settings to a local .ipbak file (SQLite database included when under 80 MB).
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Backup folder"
                    value={backupLocation}
                    placeholder="Click Browse Folder to choose where backups are saved"
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    variant="outlined"
                    startIcon={<FolderIcon />}
                    onClick={() => void handleChangeBackupLocation()}
                    fullWidth
                  >
                    Browse Folder
                  </Button>
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<BackupIcon />}
                onClick={() => void handleCreateBackup()}
                disabled={loading || !backupLocation.trim()}
                size="large"
              >
                {loading ? 'Creating Backup...' : 'Create Manual Backup'}
              </Button>

              <Button
                variant="outlined"
                startIcon={<ScheduleIcon />}
                onClick={() => setShowAutoBackupDialog(true)}
              >
                Auto Backup Settings
              </Button>
            </Box>

            {loading && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Creating backup... {progress}%
                </Typography>
                <LinearProgress variant="determinate" value={progress} />
              </Box>
            )}

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Last Backup:</strong> {stats.lastBackup ? formatDate(stats.lastBackup) : 'Never'} •
                <strong> Total Backups:</strong> {stats.totalBackups} •
                <strong> Total Size:</strong> {stats.totalSize}
              </Typography>
            </Alert>
          </Paper>
        </Grid>

        {/* Restore Backup Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <RestoreIcon sx={{ mr: 1 }} />
              Restore from Backup
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Restore your data from a previously created backup file
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Select Backup File"
                    value={backupFile}
                    InputProps={{ readOnly: true }}
                    placeholder="Click Browse to select .ipbak file"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    variant="outlined"
                    onClick={() => void handleBrowseBackupFile()}
                    fullWidth
                  >
                    Browse Backup File
                  </Button>
                </Grid>
              </Grid>
            </Box>

            <Button
              variant="contained"
              color="secondary"
              startIcon={<RestoreIcon />}
              onClick={() => setShowRestoreDialog(true)}
              disabled={!backupFile}
              size="large"
            >
              Restore Data
            </Button>

            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Warning:</strong> Restoring will replace ALL current data. A backup of current data will be created automatically before restoring.
              </Typography>
            </Alert>
          </Paper>
        </Grid>

        {/* Backup History */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <HistoryIcon sx={{ mr: 1 }} />
              Backup History
            </Typography>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date & Time</TableCell>
                    <TableCell>File Name</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.id}>
                      <TableCell>{formatDate(backup.createdAt)}</TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {backup.fileName}
                      </TableCell>
                      <TableCell>{backup.size}</TableCell>
                      <TableCell>
                        <Chip
                          label={backup.type}
                          size="small"
                          color={backup.type === 'auto' ? 'default' : 'primary'}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => setShowBackupInfo(backup)}
                          title="View Details"
                        >
                          <InfoIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setBackupFile(backup.filePath || `${backup.location}\\${backup.fileName}`);
                            setShowRestoreDialog(true);
                          }}
                          title="Restore"
                        >
                          <RestoreIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteBackup(backup.id)}
                          title="Delete"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {backups.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No backups found. Create your first backup above.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Large database confirmation */}
      <Dialog open={showLargeDbDialog} onClose={() => setShowLargeDbDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
          Database Too Large for Backup
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Your SQLite database ({largeDbMeta?.dbSizeLabel || 'over 80 MB'}) exceeds the 80 MB inline backup limit.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Continuing without the database will save company profile, settings, and JSON masters only. Vouchers and
            inventory stored in SQLite will not be included. Restore from such a backup cannot recover that data.
          </Typography>
          {largeDbMeta?.error ? (
            <Alert severity="warning">{largeDbMeta.error}</Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLargeDbDialog(false)} autoFocus>
            Cancel
          </Button>
          <Button onClick={() => void handleContinueWithoutDatabase()} color="warning" variant="contained">
            Continue Without Database
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={showRestoreDialog} onClose={() => setShowRestoreDialog(false)} maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
          Confirm Data Restore
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            This will REPLACE ALL current data with the backup data.
          </Typography>

          {backupFile && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Selected Backup:
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {backupFile}
              </Typography>
              {restorePreview ? (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Company: {restorePreview.companyName || '—'} • Created:{' '}
                  {restorePreview.createdAt ? formatDate(restorePreview.createdAt) : '—'} • Sections:{' '}
                  {(restorePreview.sections || []).join(', ') || '—'}
                  {restorePreview.hasDatabase ? ' • Includes database' : ''}
                  {restorePreview.databaseSkipped ? ' • Database was skipped in backup' : ''}
                  {(restorePreview.restoreWarnings || []).length > 0
                    ? ` • Warnings: ${(restorePreview.restoreWarnings || []).join('; ')}`
                    : ''}
                </Typography>
              ) : null}
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" sx={{ mb: 2 }}>
            To proceed, type "RESTORE" in the field below:
          </Typography>

          <TextField
            fullWidth
            label="Type RESTORE to confirm"
            value={confirmRestore}
            onChange={(e) => setConfirmRestore(e.target.value)}
            error={confirmRestore !== '' && confirmRestore !== 'RESTORE'}
            helperText={confirmRestore !== '' && confirmRestore !== 'RESTORE' ? 'Please type exactly "RESTORE"' : ''}
          />

          {loading && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                Restoring data... {progress}%
              </Typography>
              <LinearProgress variant="determinate" value={progress} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRestoreDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleRestoreBackup}
            variant="contained"
            color="warning"
            disabled={confirmRestore !== 'RESTORE' || loading}
          >
            {loading ? 'Restoring...' : 'Confirm & Restore'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Auto Backup Settings Dialog */}
      <Dialog open={showAutoBackupDialog} onClose={() => setShowAutoBackupDialog(false)}>
        <DialogTitle>Auto Backup Settings</DialogTitle>
        <DialogContent sx={{ minWidth: 400 }}>
          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={stats.autoBackupEnabled}
                  onChange={(e) => setStats(prev => ({ ...prev, autoBackupEnabled: e.target.checked }))}
                />
              }
              label="Enable Automatic Backups"
            />
          </Box>

          {stats.autoBackupEnabled && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Backup destination
              </Typography>
              <FormControlLabel
                control={
                  <Switch checked={destinations.local} onChange={(e) => setDestinations((d) => ({ ...d, local: e.target.checked }))} />
                }
                label="Local folder (active)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={destinations.googleDrive}
                    onChange={(e) => setDestinations((d) => ({ ...d, googleDrive: e.target.checked }))}
                    disabled
                  />
                }
                label="Google Drive (future-ready)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={destinations.firebase}
                    onChange={(e) => setDestinations((d) => ({ ...d, firebase: e.target.checked }))}
                    disabled
                  />
                }
                label="Firebase Storage (optional, coming soon)"
              />

              <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={stats.autoBackupFrequency}
                  onChange={(e) => setStats(prev => ({ ...prev, autoBackupFrequency: e.target.value as any }))}
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly (Monday)</MenuItem>
                  <MenuItem value="monthly">Monthly (1st)</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Backup Time"
                type="time"
                value={stats.autoBackupTime}
                onChange={(e) => setStats(prev => ({ ...prev, autoBackupTime: e.target.value }))}
                sx={{ mb: 2 }}
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                fullWidth
                label="Keep backups for (days)"
                type="number"
                value={stats.retentionDays}
                onChange={(e) => setStats(prev => ({ ...prev, retentionDays: parseInt(e.target.value) || 10 }))}
                helperText="Older backups will be automatically deleted"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAutoBackupDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveAutoBackupSettings} variant="contained">
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Backup Info Dialog */}
      <Dialog open={!!showBackupInfo} onClose={() => setShowBackupInfo(null)} maxWidth="sm">
        <DialogTitle>Backup Details</DialogTitle>
        <DialogContent>
          {showBackupInfo && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                File: {showBackupInfo.fileName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Created: {formatDate(showBackupInfo.createdAt)} • Size: {showBackupInfo.size}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Company</Typography>
                  <Typography variant="body2">{showBackupInfo.companyName}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Type</Typography>
                  <Chip label={showBackupInfo.type} size="small" />
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Invoices</Typography>
                  <Typography variant="body2">{showBackupInfo.invoiceCount}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Customers</Typography>
                  <Typography variant="body2">{showBackupInfo.customerCount}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Suppliers</Typography>
                  <Typography variant="body2">{showBackupInfo.supplierCount}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Location</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {showBackupInfo.location}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBackupInfo(null)}>Close</Button>
          <Button
            variant="outlined"
            onClick={() => {
              const target = showBackupInfo?.filePath || showBackupInfo?.location;
              if (target) void revealPathInFolder(target);
            }}
          >
            Open Folder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BackupRestore;
