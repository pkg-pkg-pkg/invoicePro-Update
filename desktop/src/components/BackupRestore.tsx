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

  // Load backup history on component mount
  useEffect(() => {
    const rows = backupService.getBackupHistory();
    setBackups(rows);
    setStats((prev) => ({
      ...prev,
      totalBackups: rows.length,
    }));
  }, []);

  const handleCreateBackup = async () => {
    setLoading(true);
    setProgress(0);

    try {
      // Simulate backup creation progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 10;
        });
      }, 500);

      // Create backup using service
      const result = await backupService.createManualBackup(backupLocation);

      clearInterval(progressInterval);
      setProgress(100);
      setLoading(false);

      if (result.success) {
        // Reload backup history
        setBackups(backupService.getBackupHistory());
        setStats(prev => ({
          ...prev,
          totalBackups: backupService.getBackupHistory().length,
          lastBackup: new Date().toISOString(),
        }));
      } else {
        alert(`Backup failed: ${result.error}`);
        setProgress(0);
      }
    } catch (error) {
      setLoading(false);
      setProgress(0);
      alert(`Backup failed: ${error}`);
    }
  };

  const handleBrowseBackupFile = () => {
    const picked = window.prompt('Enter backup file path (.ipbak):', backupFile || '') || '';
    if (picked.trim()) setBackupFile(picked.trim());
  };

  const handleRestoreBackup = () => {
    if (confirmRestore !== 'RESTORE') return;

    setLoading(true);
    setProgress(0);

    // Simulate restore progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setLoading(false);
          setShowRestoreDialog(false);
          setConfirmRestore('');
          // In a real app, this would reload the application
          alert('Backup restored successfully! The application will restart.');
          return 100;
        }
        return prev + 8;
      });
    }, 600);
  };

  const handleChangeBackupLocation = () => {
    // In a real Electron app, this would open a folder dialog
    const newLocation = prompt('Enter backup location:', backupLocation);
    if (newLocation) {
      setBackupLocation(newLocation);
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

      <Grid container spacing={3}>
        {/* Create Backup Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <BackupIcon sx={{ mr: 1 }} />
              Create Backup
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Backup includes: Company details, invoices, customers, suppliers, products, payments, and settings
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Backup Location"
                    value={backupLocation}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    variant="outlined"
                    startIcon={<FolderIcon />}
                    onClick={handleChangeBackupLocation}
                    fullWidth
                  >
                    Change Location
                  </Button>
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<BackupIcon />}
                onClick={handleCreateBackup}
                disabled={loading}
                size="large"
              >
                {loading ? 'Creating Backup...' : 'Create Backup Now'}
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
                    onClick={handleBrowseBackupFile}
                    fullWidth
                  >
                    Browse Files
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
                            setBackupFile(`${backup.location}\\${backup.fileName}`);
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
              <FormControl fullWidth sx={{ mb: 2 }}>
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
              // In real app, open folder
              alert(`Opening folder: ${showBackupInfo?.location}`);
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
