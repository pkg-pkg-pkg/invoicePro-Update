import { useEffect, useState, ChangeEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Typography, Paper, Box, TextField, Button, Divider, Alert, Grid, IconButton, Tabs, Tab, FormControlLabel, Switch, Chip, Stack, Card, CardContent, ToggleButton, ToggleButtonGroup } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import NavigationCustomization from '../components/NavigationCustomization';
import PrintCustomization from '../components/PrintCustomization';
import WhatsAppSettings from '../components/WhatsAppSettings';
import UserManagement from './UserManagement';
import AboutAndUpdates from '../components/AboutAndUpdates';
import BackupRestore from '../components/BackupRestore';
import { networkService, NetworkStatus } from '../services/networkService';
import { syncPasswordToFirestore } from '../services/userProfileService';
import { invoke } from '@tauri-apps/api/core';
import { getAppSettings, saveAppSettings } from '../services/appSettingsService';
import { usePermissions } from '../hooks/usePermissions';
import { isTauriRuntime, isElectronRuntime } from '../utils/runtime';
import { auth } from '../firebase/firebase';
import {
  callSubmitMultiUserUpgrade,
  callGetMyMultiUserUpgradeStatus,
  callSubmitGatewayRenewal,
  callGetMyGatewayRenewalStatus,
  refreshMultiUserLanInCache,
} from '../services/licenseService';
import { syncHostMultiUserLanFromCloud } from '../services/hostLicenseSyncService';
import {
  MULTI_USER_UPI_PAYEE,
  MULTI_USER_PRICING_LABEL,
  multiUserUpiQrImageUrl,
} from '../constants/multiUserLanUpgrade';
import {
  GATEWAY_UPI_PAYEE,
  GATEWAY_PRICING_LABEL,
  gatewayUpiQrImageUrl,
  GATEWAY_RENEWAL_AMOUNT_INR,
} from '../constants/gatewayRenewal';
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  APPEARANCE_CHANGED_EVENT,
  applyAppearanceAndNotify,
  readAccentColor,
  readUiMode,
  type UiMode,
} from '../theme/appearanceSettings';

// Password Change Form Component
const PasswordChangeForm = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'All fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Get current user from localStorage
      const users = JSON.parse(localStorage.getItem('gst_billing_users') || '[]');
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      
      const userIndex = users.findIndex((u: any) => u.email === currentUser.email);
      
      if (userIndex === -1) {
        setMessage({ type: 'error', text: 'User not found' });
        return;
      }

      const user = users[userIndex];
      
      // Verify current password (simple check for offline mode)
      if (user.password !== currentPassword) {
        setMessage({ type: 'error', text: 'Current password is incorrect' });
        return;
      }

      // Update password locally
      users[userIndex] = {
        ...user,
        password: newPassword,
        passwordResetRequired: false,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem('gst_billing_users', JSON.stringify(users));

      // Also sync the new password to Firestore so that future logins
      // on other devices can restore it.
      if (currentUser.email) {
        await syncPasswordToFirestore(currentUser.email, newPassword, {
          passwordResetRequired: false,
        });
      }
      
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 500 }}>
      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }}>
          {message.text}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            type="password"
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
        </Grid>
        
        <Grid item xs={12}>
          <Button
            variant="contained"
            onClick={handleChangePassword}
            disabled={loading}
            size="large"
          >
            {loading ? 'Changing Password...' : 'Change Password'}
          </Button>
        </Grid>
      </Grid>
      
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Password Requirements:</strong>
          <br />• Minimum 6 characters
          <br />• Use a mix of letters and numbers for better security
          <br />• Avoid using common passwords
        </Typography>
      </Alert>
    </Box>
  );
};

interface CompanyProfile {
  name: string;
  address: string;
  statePin: string;
  mobiles: string;
  email: string;
  website: string;
  gstin: string;
}

interface CompanyMediaInfo {
  logo?: string;
  signature?: string;
}

function AppearanceSettingsSection() {
  const [uiMode, setUiMode] = useState<UiMode>(() => readUiMode());
  const [accent, setAccent] = useState(() => readAccentColor());

  useEffect(() => {
    const sync = () => {
      setUiMode(readUiMode());
      setAccent(readAccentColor());
    };
    window.addEventListener(APPEARANCE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(APPEARANCE_CHANGED_EVENT, sync);
  }, []);

  const apply = (mode: UiMode, hex: string) => {
    applyAppearanceAndNotify(mode, hex);
    setUiMode(readUiMode());
    setAccent(readAccentColor());
  };

  return (
    <Grid item xs={12}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Colours & theme
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose shell mode and accent colour. The top bar, sidebar, and main area update together; sidebar uses a slightly different tint than the body so they stay visually separate. Text and buttons adjust for readability.
        </Typography>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Theme
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={uiMode}
          onChange={(_, v) => {
            if (v != null) apply(v as UiMode, accent);
          }}
          sx={{ mb: 3 }}
        >
          <ToggleButton value="premium-dark">Premium dark</ToggleButton>
          <ToggleButton value="light">Light</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Accent colour
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
          {ACCENT_PRESETS.map((p) => (
            <Box
              key={p.value}
              component="button"
              type="button"
              title={p.label}
              onClick={() => apply(uiMode, p.value)}
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                border: accent.toLowerCase() === p.value.toLowerCase() ? '2px solid' : '1px solid',
                borderColor: accent.toLowerCase() === p.value.toLowerCase() ? 'primary.main' : 'divider',
                bgcolor: p.value,
                cursor: 'pointer',
                p: 0,
              }}
            />
          ))}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField
            label="Hex colour"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            onBlur={() => {
              const t = accent.trim();
              if (/^#?[0-9A-Fa-f]{6}$/.test(t)) apply(uiMode, t.startsWith('#') ? t : `#${t}`);
              else setAccent(readAccentColor());
            }}
            placeholder={DEFAULT_ACCENT}
            size="small"
            sx={{ minWidth: 140 }}
          />
          <TextField
            type="color"
            label="Picker"
            value={/^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : DEFAULT_ACCENT}
            onChange={(e) => apply(uiMode, e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 120 }}
          />
        </Stack>
      </Paper>
    </Grid>
  );
}

export default function Settings() {
  const { canAccessFeature } = usePermissions();
  const canManageSettings = canAccessFeature('manage-settings');
  const canManageCompany = canAccessFeature('manage-company');
  const canManageUsers = canAccessFeature('manage-users');
  const canCustomizePrint = canAccessFeature('customize-print');
  const canBackup = canAccessFeature('backup-data');
  const canRestore = canAccessFeature('restore-data');

  if (!canManageSettings) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You do not have permission to access Settings</Alert>
      </Box>
    );
  }

  const [activeTab, setActiveTab] = useState<number>(0);
  const location = useLocation();
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(networkService.getStatus());

  // Deep-link from Connect to Host: #/settings?tab=multiuser (UPI / LAN upgrade)
  useEffect(() => {
    const fromRouter = new URLSearchParams(location.search).get('tab');
    let fromHash: string | null = null;
    try {
      const hash = window.location.hash || '';
      const qIdx = hash.indexOf('?');
      if (qIdx >= 0) {
        fromHash = new URLSearchParams(hash.slice(qIdx + 1)).get('tab');
      }
    } catch {
      fromHash = null;
    }
    const t = fromRouter || fromHash;
    if (t === 'multiuser' || t === 'network') {
      setActiveTab(7);
    } else if (t === 'about' || t === 'updates') {
      setActiveTab(2);
    } else if (t === 'appearance' || t === 'layout') {
      setActiveTab(9);
    } else if (t === 'appsettings') {
      setActiveTab(10);
    }
  }, [location.search, location.pathname]);

  const [appSettings, setAppSettings] = useState(() => getAppSettings());
  const [appSettingsSaved, setAppSettingsSaved] = useState(false);
  const [appSettingsError, setAppSettingsError] = useState<string | null>(null);

  const loadCompanyMedia = (): CompanyMediaInfo => {
    try {
      const raw = localStorage.getItem('company-info');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return {
        logo: String(parsed?.logo ?? '').trim() || undefined,
        signature: String(parsed?.signature ?? '').trim() || undefined,
      };
    } catch {
      return {};
    }
  };
  const [companyMedia, setCompanyMedia] = useState<CompanyMediaInfo>(loadCompanyMedia());

  const [licenseState, setLicenseState] = useState<any>(null);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activationCodeInput, setActivationCodeInput] = useState('');
  const [activating, setActivating] = useState(false);

  const [clientServerUrl, setClientServerUrl] = useState<string>('');

  const [firestoreMultiUserLan, setFirestoreMultiUserLan] = useState(false);
  const [upgradeUtr, setUpgradeUtr] = useState('');
  const [upgradeSubmitting, setUpgradeSubmitting] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<string | null>(null);
  const [upgradeRequest, setUpgradeRequest] = useState<any | null>(null);

  const [gatewayValidUntilMs, setGatewayValidUntilMs] = useState<number | null>(null);
  const [gatewayUpdatesEntitled, setGatewayUpdatesEntitled] = useState<boolean>(true);
  const [gatewayRenewUtr, setGatewayRenewUtr] = useState('');
  const [gatewayRenewSubmitting, setGatewayRenewSubmitting] = useState(false);
  const [gatewayRenewInfo, setGatewayRenewInfo] = useState<string | null>(null);
  const [gatewayRenewRequest, setGatewayRenewRequest] = useState<any | null>(null);

  const loadCompanyProfile = (): CompanyProfile => ({
    name: localStorage.getItem('companyName')?.trim() || 'GST Billing Software',
    address: localStorage.getItem('companyAddress')?.trim() || '',
    statePin: localStorage.getItem('companyStatePin')?.trim() || '',
    mobiles: localStorage.getItem('companyMobiles')?.trim() || '',
    email: localStorage.getItem('companyEmail')?.trim() || '',
    website: localStorage.getItem('companyWebsite')?.trim() || '',
    gstin: localStorage.getItem('companyGSTIN')?.trim() || ''
  });

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(loadCompanyProfile());
  const [originalProfile, setOriginalProfile] = useState<CompanyProfile>(loadCompanyProfile());
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Partial<CompanyProfile>>({});

  const refreshLicenseState = async () => {
    if (!isTauriRuntime()) return;
    setLicenseLoading(true);
    setLicenseError(null);
    try {
      const st: any = await invoke('get_license_state');
      setLicenseState(st);
      if (st?.licenseKey && !licenseKeyInput) setLicenseKeyInput(String(st.licenseKey));
    } catch (e: any) {
      setLicenseError(e?.message ?? 'Failed to load license status');
    } finally {
      setLicenseLoading(false);
    }
  };

  // Network settings handlers
  const handleMultiUserToggle = async (enabled: boolean) => {
    try {
      networkService.setEnabled(enabled);
      setNetworkStatus(networkService.getStatus());
    } catch (error) {
      console.error('Failed to toggle multi-user mode:', error);
    }
  };

  const handleConnectClient = async () => {
    try {
      const url = clientServerUrl.trim();
      if (!url) return;
      const ok = await networkService.connectToServer(url);
      if (!ok) {
        setLicenseError('Failed to connect. Check Host URL/IP and ensure server is running.');
      } else {
        setLicenseError(null);
      }
      setNetworkStatus(networkService.getStatus());
    } catch (error) {
      console.error('Failed to connect to server:', error);
      setLicenseError((error as any)?.message ?? 'Failed to connect');
    }
  };

  const handleDisconnectClient = async () => {
    try {
      await networkService.disconnect();
      setNetworkStatus(networkService.getStatus());
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const upsertCompanyInfo = (partial: Record<string, any>) => {
    try {
      const raw = localStorage.getItem('company-info');
      const prev = raw ? JSON.parse(raw) : {};
      const next = { ...prev, ...partial };
      localStorage.setItem('company-info', JSON.stringify(next));
      if (Object.prototype.hasOwnProperty.call(partial, 'logo')) {
        localStorage.setItem('companyLogo', String(partial.logo ?? ''));
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'signature')) {
        localStorage.setItem('companySignature', String(partial.signature ?? ''));
      }
      window.dispatchEvent(new Event('companyProfileUpdated'));
      return true;
    } catch (e: any) {
      const msg = String(e?.message ?? '').trim();
      if (msg.toLowerCase().includes('quota')) {
        setLicenseError('Storage full. Please upload a smaller image (try a smaller PNG/JPG/WebP).');
      } else {
        setLicenseError(msg || 'Failed to save company profile to this device');
      }
      return false;
    }
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result ? String(reader.result) : '');
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = src;
    });

  const resizeAndCompressDataUrl = async (src: string, options: { maxW: number; maxH: number; quality: number }) => {
    const img = await loadImage(src);
    const scale = Math.min(1, options.maxW / (img.width || 1), options.maxH / (img.height || 1));
    const w = Math.max(1, Math.round((img.width || 1) * scale));
    const h = Math.max(1, Math.round((img.height || 1) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return src;
    ctx.drawImage(img, 0, 0, w, h);

    let out = '';
    try {
      out = canvas.toDataURL('image/webp', options.quality);
    } catch {
      out = '';
    }
    if (!out) {
      try {
        out = canvas.toDataURL('image/jpeg', options.quality);
      } catch {
        out = '';
      }
    }
    return out || src;
  };

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLicenseError(null);
    
    // Check file size (limit increased slightly for high-res)
    if (file.size > 1024 * 1024) { // 1MB limit
      setLicenseError('Logo file too large. Max 1MB allowed.');
      return;
    }
    
    void (async () => {
      try {
        const raw = await readFileAsDataUrl(file);
        if (!raw) return;
        
        // Always compress/resize non-SVGs to save localStorage quota
        const isSvg = file.type === 'image/svg+xml';
        const result = isSvg ? raw : await resizeAndCompressDataUrl(raw, { maxW: 400, maxH: 200, quality: 0.8 });
        
        setCompanyMedia((p) => ({ ...p, logo: result }));
        const success = upsertCompanyInfo({ logo: result });
        if (!success) {
          setLicenseError('Failed to save logo. Local storage might be full.');
        }
      } catch (e: any) {
        setLicenseError(e?.message ?? 'Logo upload failed');
      }
    })();
  };

  const handleSignatureUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLicenseError(null);
    
    if (file.size > 512 * 1024) { // 512KB limit
      setLicenseError('Signature file too large. Max 512KB allowed.');
      return;
    }
    
    void (async () => {
      try {
        const raw = await readFileAsDataUrl(file);
        if (!raw) return;
        
        const isSvg = file.type === 'image/svg+xml';
        const result = isSvg ? raw : await resizeAndCompressDataUrl(raw, { maxW: 400, maxH: 150, quality: 0.8 });
        
        setCompanyMedia((p) => ({ ...p, signature: result }));
        const success = upsertCompanyInfo({ signature: result });
        if (!success) {
          setLicenseError('Failed to save signature. Local storage might be full.');
        }
      } catch (e: any) {
        setLicenseError(e?.message ?? 'Signature upload failed');
      }
    })();
  };

  const removeLogo = () => {
    setCompanyMedia((p) => ({ ...p, logo: undefined }));
    upsertCompanyInfo({ logo: '' });
  };

  const removeSignature = () => {
    setCompanyMedia((p) => ({ ...p, signature: undefined }));
    upsertCompanyInfo({ signature: '' });
  };

  const handleStartServer = async () => {
    try {
      if (isTauriRuntime() && !licenseState?.activated) {
        setLicenseError('Activate Host license before starting server');
        return;
      }
      const success = await networkService.startServer();
      if (success) {
        setNetworkStatus(networkService.getStatus());
      }
    } catch (error) {
      console.error('Failed to start server:', error);
      setLicenseError((error as any)?.message ?? 'Failed to start server');
    }
  };

  const handleStopServer = async () => {
    try {
      const success = await networkService.stopServer();
      if (success) {
        setNetworkStatus(networkService.getStatus());
      }
    } catch (error) {
      console.error('Failed to stop server:', error);
    }
  };

  const handleActivateHost = async () => {
    if (!isTauriRuntime()) return;
    const lk = licenseKeyInput.trim();
    const ac = activationCodeInput.trim();
    if (!lk || !ac) {
      setLicenseError('Enter License Key and Activation Code');
      return;
    }
    setActivating(true);
    setLicenseError(null);
    try {
      const st: any = await invoke('activate_host_license', { licenseKey: lk, activationCode: ac });
      setLicenseState(st);
      setActivationCodeInput('');
    } catch (e: any) {
      setLicenseError(e?.message ?? 'Activation failed');
    } finally {
      setActivating(false);
    }
  };

  useEffect(() => {
    const onCfg = () => setNetworkStatus(networkService.getStatus());
    window.addEventListener('networkConfigUpdated', onCfg as any);
    return () => window.removeEventListener('networkConfigUpdated', onCfg as any);
  }, []);

  useEffect(() => {
    setCompanyMedia(loadCompanyMedia());
  }, [saved]);

  useEffect(() => {
    const url = String(networkStatus.serverUrl ?? '').trim();
    if (url) {
      setClientServerUrl(url);
      return;
    }
    if (networkStatus.localIP) {
      setClientServerUrl(`http://${networkStatus.localIP}:3000`);
      return;
    }
    setClientServerUrl('');
  }, [networkStatus.serverUrl, networkStatus.localIP]);

  useEffect(() => {
    refreshLicenseState();
  }, []);

  const refreshNetworkLicenseFlags = async () => {
    setUpgradeInfo(null);
    setGatewayRenewInfo(null);
    try {
      const { multiUserLan, gatewayValidUntilMs: gMs, gatewayUpdatesEntitled: gEnt } =
        await refreshMultiUserLanInCache();
      setFirestoreMultiUserLan(multiUserLan);
      setGatewayValidUntilMs(gMs);
      setGatewayUpdatesEntitled(gEnt);
      await syncHostMultiUserLanFromCloud(multiUserLan);
      const st = await callGetMyMultiUserUpgradeStatus();
      setUpgradeRequest(st.item ?? null);
      const gwSt = await callGetMyGatewayRenewalStatus();
      setGatewayRenewRequest(gwSt.item ?? null);
      if (isTauriRuntime()) await refreshLicenseState();
    } catch (e: any) {
      setUpgradeInfo(e?.message ?? 'Could not refresh license status');
    }
  };

  const handleSubmitGatewayRenewal = async () => {
    if (!auth?.currentUser) {
      setGatewayRenewInfo('Sign in with your licensed account, then submit UTR.');
      return;
    }
    const utr = gatewayRenewUtr.trim();
    if (utr.length < 8) {
      setGatewayRenewInfo('Enter the full UTR from your payment.');
      return;
    }
    setGatewayRenewSubmitting(true);
    setGatewayRenewInfo(null);
    try {
      await callSubmitGatewayRenewal({ utr });
      setGatewayRenewUtr('');
      setGatewayRenewInfo('Renewal request sent. After admin verifies payment, click Refresh status.');
      await refreshNetworkLicenseFlags();
    } catch (e: any) {
      const msg = String(e?.message ?? e?.code ?? 'Request failed');
      setGatewayRenewInfo(msg.replace(/^functions\//, ''));
    } finally {
      setGatewayRenewSubmitting(false);
    }
  };

  const handleSubmitMultiUserUpgrade = async () => {
    if (!auth?.currentUser) {
      setUpgradeInfo('Sign in with your licensed Google / Firebase account, then submit UTR.');
      return;
    }
    const utr = upgradeUtr.trim();
    if (utr.length < 8) {
      setUpgradeInfo('Enter the full UTR from your payment (usually 12+ digits).');
      return;
    }
    setUpgradeSubmitting(true);
    setUpgradeInfo(null);
    try {
      await callSubmitMultiUserUpgrade({ utr });
      setUpgradeUtr('');
      setUpgradeInfo('Request sent for admin approval. After approval, click Refresh status and start the LAN host server.');
      await refreshNetworkLicenseFlags();
    } catch (e: any) {
      const msg = String(e?.message ?? e?.code ?? 'Request failed');
      setUpgradeInfo(msg.replace(/^functions\//, ''));
    } finally {
      setUpgradeSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 7) return;
    void refreshNetworkLicenseFlags();
  }, [activeTab]);

  useEffect(() => {
    const onSettings = () => setAppSettings(getAppSettings());
    window.addEventListener('appSettingsUpdated', onSettings as any);
    return () => window.removeEventListener('appSettingsUpdated', onSettings as any);
  }, []);

  useEffect(() => {
    setSaved(false);
  }, [companyProfile]);

  const saveAppConfig = () => {
    if (!canManageSettings) {
      alert('You do not have permission to manage app settings');
      return;
    }
    setAppSettingsError(null);
    setAppSettingsSaved(false);
    
    // Validate Financial Year
    const fyStart = String(appSettings?.financialYear?.startDate ?? '').trim();
    const fyEnd = String(appSettings?.financialYear?.endDate ?? '').trim();
    if (!fyStart || !fyEnd) {
      setAppSettingsError('Financial year start and end are required');
      return;
    }
    const s = new Date(fyStart);
    const e = new Date(fyEnd);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      setAppSettingsError('Invalid financial year dates');
      return;
    }
    if (s.getTime() > e.getTime()) {
      setAppSettingsError('Financial year start cannot be after financial year end');
      return;
    }

    // Validate Lock Date
    const lock = String(appSettings?.lockDate ?? '').trim();
    if (lock) {
      const ld = new Date(lock);
      if (Number.isNaN(ld.getTime())) {
        setAppSettingsError('Invalid lock date');
        return;
      }
    }

    // Validate Invoice Numbering
    const startNum = Number(appSettings?.invoiceNumbering?.startingNumber ?? 1);
    if (Number.isNaN(startNum) || startNum < 1) {
      setAppSettingsError('Starting number must be at least 1');
      return;
    }

    try {
      saveAppSettings({
        financialYear: { startDate: fyStart, endDate: fyEnd },
        lockDate: lock,
        features: {
          gstEnabled: Boolean(appSettings?.features?.gstEnabled),
          inventoryEnabled: Boolean(appSettings?.features?.inventoryEnabled),
          payrollEnabled: Boolean(appSettings?.features?.payrollEnabled),
          multiCurrencyEnabled: Boolean(appSettings?.features?.multiCurrencyEnabled),
        },
        invoiceNumbering: {
          prefix: String(appSettings?.invoiceNumbering?.prefix ?? '').trim(),
          suffix: String(appSettings?.invoiceNumbering?.suffix ?? '').trim(),
          startingNumber: startNum,
        },
      });
      setAppSettingsSaved(true);
    } catch (e: any) {
      setAppSettingsError(e?.message ?? 'Failed to save app settings');
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email === '' || emailRegex.test(email);
  };

  const validateGSTIN = (gstin: string) => {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstin === '' || gstinRegex.test(gstin.toUpperCase());
  };

  const handleEdit = () => {
    if (!canManageCompany) {
      alert('You do not have permission to manage company profile');
      return;
    }
    setOriginalProfile({ ...companyProfile });
    setIsEditing(true);
    setSaved(false);
    setErrors({});
  };

  const handleCancel = () => {
    setCompanyProfile({ ...originalProfile });
    setIsEditing(false);
    setErrors({});
  };

  const handleFieldChange = (field: keyof CompanyProfile, value: string) => {
    setCompanyProfile(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Validate email in real-time
    if (field === 'email' && !validateEmail(value)) {
      setErrors(prev => ({ ...prev, email: 'Invalid email format' }));
    }

    // Validate GSTIN in real-time
    if (field === 'gstin' && !validateGSTIN(value)) {
      setErrors(prev => ({ ...prev, gstin: 'Invalid GSTIN format (15 characters)' }));
    }
  };

  const handleSave = () => {
    if (!canManageCompany) {
      alert('You do not have permission to manage company profile');
      return;
    }
    const newErrors: Partial<CompanyProfile> = {};

    // Validate required fields
    if (!companyProfile.name.trim()) {
      newErrors.name = 'Company name is required';
    }

    // Validate email format
    if (!validateEmail(companyProfile.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Validate GSTIN format
    if (!validateGSTIN(companyProfile.gstin)) {
      newErrors.gstin = 'Invalid GSTIN format (15 characters)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Save to localStorage
    localStorage.setItem('companyName', companyProfile.name.trim());
    localStorage.setItem('companyAddress', companyProfile.address.trim());
    localStorage.setItem('companyStatePin', companyProfile.statePin.trim());
    localStorage.setItem('companyMobiles', companyProfile.mobiles.trim());
    localStorage.setItem('companyEmail', companyProfile.email.trim());
    localStorage.setItem('companyWebsite', companyProfile.website.trim());
    localStorage.setItem('companyGSTIN', companyProfile.gstin.trim());

    upsertCompanyInfo({
      name: companyProfile.name.trim(),
      address: companyProfile.address.trim(),
      phone: companyProfile.mobiles.trim(),
      email: companyProfile.email.trim(),
      gstin: companyProfile.gstin.trim(),
      logo: companyMedia.logo ?? '',
      signature: companyMedia.signature ?? '',
    });

    // Dispatch event for other components to update
    window.dispatchEvent(new Event('companyProfileUpdated'));
    setSaved(true);
    setErrors({});
    setIsEditing(false);
  };

  return (
    <Box p={2}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Paper sx={{ mt: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Company Profile" />
          <Tab label="Navigation" />
          <Tab label="About & Updates" />
          <Tab label="Print Settings" disabled={!canCustomizePrint} />
          <Tab label="WhatsApp" />
          <Tab label="User Management" disabled={!canManageUsers} />
          <Tab label="Change Password" />
          <Tab label="Network & Multi-User" />
          <Tab label="Backup & Restore" disabled={!(canBackup || canRestore)} />
          <Tab label="Layout" />
          <Tab label="App Settings" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <Box sx={{ p: 0 }}>
          <Box sx={{ 
            p: 4, 
            background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', 
            color: 'white',
            borderRadius: '0 0 24px 24px',
            mb: 4,
            boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.2)'
          }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h4" fontWeight={900}>Company Identity</Typography>
                <Typography variant="body1" sx={{ opacity: 0.8 }}>
                  Your business profile used across invoices and documents
                </Typography>
              </Box>
              {!isEditing && (
                <Button 
                  variant="contained" 
                  onClick={handleEdit} 
                  startIcon={<EditIcon />}
                  disabled={!canManageCompany}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)', 
                    backdropFilter: 'blur(10px)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                  }}
                >
                  Edit Profile
                </Button>
              )}
            </Stack>
          </Box>

          <Grid container spacing={4} sx={{ px: 4, pb: 4 }}>
            <Grid item xs={12} md={4}>
              <Stack spacing={3}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 3, borderRadius: 4 }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={700} gutterBottom>
                    COMPANY LOGO
                  </Typography>
                  <Box sx={{ 
                    width: '100%', 
                    height: 200, 
                    border: '2px dashed #e2e8f0', 
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#f8fafc',
                    mb: 2,
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {companyMedia.logo ? (
                      <Box component="img" src={companyMedia.logo} sx={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                    ) : (
                      <Typography color="text.disabled">No Logo Uploaded</Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1} justifyContent="center">
                    <Button component="label" variant="contained" size="small" disabled={!canManageCompany}>
                      Upload
                      <input hidden type="file" accept="image/*" onChange={handleLogoUpload} />
                    </Button>
                    {companyMedia.logo && (
                      <Button variant="outlined" color="error" size="small" onClick={removeLogo} disabled={!canManageCompany}>
                        Remove
                      </Button>
                    )}
                  </Stack>
                </Card>

                <Card variant="outlined" sx={{ textAlign: 'center', p: 3, borderRadius: 4 }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={700} gutterBottom>
                    AUTHORIZED SIGNATURE
                  </Typography>
                  <Box sx={{ 
                    width: '100%', 
                    height: 120, 
                    border: '2px dashed #e2e8f0', 
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#f8fafc',
                    mb: 2,
                    overflow: 'hidden'
                  }}>
                    {companyMedia.signature ? (
                      <Box component="img" src={companyMedia.signature} sx={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                    ) : (
                      <Typography color="text.disabled">No Signature Uploaded</Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1} justifyContent="center">
                    <Button component="label" variant="contained" size="small" disabled={!canManageCompany}>
                      Upload
                      <input hidden type="file" accept="image/*" onChange={handleSignatureUpload} />
                    </Button>
                    {companyMedia.signature && (
                      <Button variant="outlined" color="error" size="small" onClick={removeSignature} disabled={!canManageCompany}>
                        Remove
                      </Button>
                    )}
                  </Stack>
                </Card>
              </Stack>
            </Grid>

            <Grid item xs={12} md={8}>
              <Card variant="outlined" sx={{ p: 4, borderRadius: 4 }}>
                <Typography variant="h6" fontWeight={800} gutterBottom>Business Details</Typography>
                <Divider sx={{ mb: 4 }} />
                
                {isEditing ? (
                  <Stack spacing={3}>
                    <TextField
                      label="Legal Business Name"
                      value={companyProfile.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      fullWidth
                      error={!!errors.name}
                      helperText={errors.name}
                      InputProps={{ sx: { borderRadius: 2 } }}
                    />
                    <TextField
                      label="Full Address"
                      value={companyProfile.address}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      fullWidth
                      multiline
                      rows={3}
                      InputProps={{ sx: { borderRadius: 2 } }}
                    />
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="State & PIN"
                          value={companyProfile.statePin}
                          onChange={(e) => handleFieldChange('statePin', e.target.value)}
                          fullWidth
                          InputProps={{ sx: { borderRadius: 2 } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="GSTIN"
                          value={companyProfile.gstin}
                          onChange={(e) => handleFieldChange('gstin', e.target.value)}
                          fullWidth
                          error={!!errors.gstin}
                          helperText={errors.gstin}
                          InputProps={{ sx: { borderRadius: 2 } }}
                        />
                      </Grid>
                    </Grid>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="Phone Numbers"
                          value={companyProfile.mobiles}
                          onChange={(e) => handleFieldChange('mobiles', e.target.value)}
                          fullWidth
                          InputProps={{ sx: { borderRadius: 2 } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="Business Email"
                          value={companyProfile.email}
                          onChange={(e) => handleFieldChange('email', e.target.value)}
                          fullWidth
                          error={!!errors.email}
                          helperText={errors.email}
                          InputProps={{ sx: { borderRadius: 2 } }}
                        />
                      </Grid>
                    </Grid>
                    <TextField
                      label="Website"
                      value={companyProfile.website}
                      onChange={(e) => handleFieldChange('website', e.target.value)}
                      fullWidth
                      InputProps={{ sx: { borderRadius: 2 } }}
                    />
                    <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                      <Button variant="contained" size="large" onClick={handleSave} sx={{ px: 6, borderRadius: 2 }}>
                        Save Profile
                      </Button>
                      <Button variant="outlined" size="large" onClick={handleCancel} sx={{ borderRadius: 2 }}>
                        Cancel
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Grid container spacing={4}>
                    {[
                      { label: 'Business Name', value: companyProfile.name, icon: '🏢' },
                      { label: 'GSTIN', value: companyProfile.gstin, icon: '📜' },
                      { label: 'Phone', value: companyProfile.mobiles, icon: '📞' },
                      { label: 'Email', value: companyProfile.email, icon: '✉️' },
                      { label: 'Website', value: companyProfile.website, icon: '🌐' },
                      { label: 'Address', value: companyProfile.address, icon: '📍', full: true },
                      { label: 'State & PIN', value: companyProfile.statePin, icon: '🗺️' },
                    ].map((item, idx) => (
                      <Grid item xs={12} sm={item.full ? 12 : 6} key={idx}>
                        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                          {item.icon} {item.label}
                        </Typography>
                        <Typography variant="body1" fontWeight={600} sx={{ mt: 0.5, wordBreak: 'break-word' }}>
                          {item.value || '—'}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Card>
            </Grid>
          </Grid>
          {saved && (
            <Alert severity="success" sx={{ mx: 4, mb: 4, borderRadius: 3 }}>
              Company profile updated successfully!
            </Alert>
          )}
          {licenseError && (
            <Alert severity="error" sx={{ mx: 4, mb: 4, borderRadius: 3 }}>
              {licenseError}
            </Alert>
          )}
        </Box>
      )}

      {activeTab === 1 && (
        <NavigationCustomization />
      )}

      {activeTab === 2 && <AboutAndUpdates />}

        {activeTab === 3 && (
          canCustomizePrint ? <PrintCustomization /> : <Alert severity="error" sx={{ mt: 3 }}>You do not have permission to customize print</Alert>
        )}

        {activeTab === 4 && (
          <WhatsAppSettings />
        )}

        {activeTab === 5 && (
          canManageUsers ? <UserManagement /> : <Alert severity="error" sx={{ mt: 3 }}>You do not have permission to manage users</Alert>
        )}

        {activeTab === 6 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Change Password
            </Typography>
            <PasswordChangeForm />
          </Box>
        )}

        {activeTab === 7 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Network & Multi-User Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure multi-user access over your local network for team collaboration.
            </Typography>

            <Grid container spacing={3}>
              {isElectronRuntime() && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    Real LAN host (HTTP server for other PCs) runs in the <strong>Tauri</strong> build. In Electron,
                    Start Server is simulated only—use the Tauri installer on the machine that will be the office host.
                  </Alert>
                </Grid>
              )}

              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Gateway validity (updates &amp; new features)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Your <strong>license key stays valid</strong> for using the software. <strong>Gateway</strong> covers
                    app updates and new features (similar to Tally). New activations include <strong>1 year</strong> free
                    Gateway; after that renew yearly at <strong>{GATEWAY_PRICING_LABEL}</strong>.
                  </Typography>
                  {gatewayValidUntilMs != null ? (
                    <Alert severity={gatewayUpdatesEntitled ? 'success' : 'warning'} sx={{ mb: 2 }}>
                      <strong>Valid until:</strong>{' '}
                      {new Date(gatewayValidUntilMs).toLocaleString()}
                      {!gatewayUpdatesEntitled && (
                        <>
                          <br />
                          Gateway expired — renew below to receive updates and new features again.
                        </>
                      )}
                    </Alert>
                  ) : (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Open the app online once after activation to sync Gateway dates from the server.
                    </Alert>
                  )}

                  {gatewayRenewRequest?.status === 'pending' && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Renewal <strong>pending</strong> admin verification (UTR: {String(gatewayRenewRequest.utr ?? '')}).
                    </Alert>
                  )}
                  {gatewayRenewRequest?.status === 'rejected' && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      Renewal rejected
                      {gatewayRenewRequest.rejectReason ? `: ${gatewayRenewRequest.rejectReason}` : ''}.
                    </Alert>
                  )}

                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Pay via UPI using the QR, then enter the bank <strong>UTR</strong>. Admin will verify and extend
                    Gateway by <strong>1 year</strong> on your license.
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
                    <Box>
                      <Box
                        component="img"
                        src={gatewayUpiQrImageUrl(220)}
                        alt="Gateway renewal UPI QR"
                        sx={{ width: 220, height: 220, border: 1, borderColor: 'divider', borderRadius: 1 }}
                      />
                    </Box>
                    <Box sx={{ flex: '1 1 240px', minWidth: 240 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        UPI ID: <strong>{GATEWAY_UPI_PAYEE}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        Amount: <strong>₹{GATEWAY_RENEWAL_AMOUNT_INR.toFixed(2)}</strong> ({GATEWAY_PRICING_LABEL})
                      </Typography>
                      <TextField
                        label="UTR after payment"
                        value={gatewayRenewUtr}
                        onChange={(e) => setGatewayRenewUtr(e.target.value)}
                        size="small"
                        fullWidth
                        sx={{ mb: 2 }}
                        placeholder="Bank UTR / reference"
                      />
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => void handleSubmitGatewayRenewal()}
                        disabled={gatewayRenewSubmitting}
                      >
                        Submit UTR for renewal
                      </Button>
                      {gatewayRenewInfo && (
                        <Alert severity={gatewayRenewInfo.includes('sent') ? 'success' : 'warning'} sx={{ mt: 2 }}>
                          {gatewayRenewInfo}
                        </Alert>
                      )}
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Multi-user LAN license (paid upgrade)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Single-user plans do not include unlimited LAN PCs. Pay {MULTI_USER_PRICING_LABEL} via UPI; after
                    admin verifies your UTR, your Firestore license unlocks multi-workstation use and the host can
                    serve clients on your LAN.
                  </Typography>
                  {firestoreMultiUserLan ? (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Multi-user LAN is active on your license. You can activate additional PCs with the same key and
                      run the app on one admin PC as LAN host (Tauri).
                    </Alert>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
                      <Box>
                        <Box
                          component="img"
                          src={multiUserUpiQrImageUrl(220)}
                          alt="UPI payment QR"
                          sx={{ width: 220, height: 220, border: 1, borderColor: 'divider', borderRadius: 1 }}
                        />
                      </Box>
                      <Box sx={{ flex: '1 1 240px', minWidth: 240 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          UPI ID: <strong>{MULTI_USER_UPI_PAYEE}</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          Amount: <strong>₹11,800.00</strong> ({MULTI_USER_PRICING_LABEL})
                        </Typography>
                        <TextField
                          label="UTR / reference after payment"
                          value={upgradeUtr}
                          onChange={(e) => setUpgradeUtr(e.target.value)}
                          size="small"
                          fullWidth
                          sx={{ mb: 2 }}
                          placeholder="Bank UTR from payment confirmation"
                        />
                        <Button
                          variant="contained"
                          color="success"
                          onClick={() => void handleSubmitMultiUserUpgrade()}
                          disabled={upgradeSubmitting}
                        >
                          Submit UTR for approval
                        </Button>
                        {upgradeRequest?.status === 'pending' && (
                          <Alert severity="info" sx={{ mt: 2 }}>
                            Your upgrade is <strong>pending</strong> admin verification (UTR: {String(upgradeRequest.utr ?? '')}
                            ).
                          </Alert>
                        )}
                        {upgradeRequest?.status === 'rejected' && (
                          <Alert severity="error" sx={{ mt: 2 }}>
                            Rejected
                            {upgradeRequest.rejectReason ? `: ${upgradeRequest.rejectReason}` : ''}. Contact support if
                            this looks wrong.
                          </Alert>
                        )}
                        {upgradeRequest?.status === 'approved' && !firestoreMultiUserLan && (
                          <Alert severity="warning" sx={{ mt: 2 }}>
                            Request was approved — click <strong>Refresh status</strong> to sync your device.
                          </Alert>
                        )}
                      </Box>
                    </Box>
                  )}
                  {upgradeInfo && (
                    <Alert severity={upgradeInfo.includes('sent') ? 'success' : 'warning'} sx={{ mt: 2 }}>
                      {upgradeInfo}
                    </Alert>
                  )}
                  <Button variant="outlined" size="small" sx={{ mt: 2 }} onClick={() => void refreshNetworkLicenseFlags()}>
                    Refresh status
                  </Button>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Multi-User Mode
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={networkStatus.isEnabled}
                          onChange={(e) => handleMultiUserToggle(e.target.checked)}
                        />
                      }
                      label="Enable Multi-User Mode"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    When enabled, other users on your network can access this application.
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Client Connection
                  </Typography>
                  <TextField
                    label="Host Server URL"
                    value={clientServerUrl}
                    onChange={(e) => setClientServerUrl(e.target.value)}
                    size="small"
                    fullWidth
                    disabled={!networkStatus.isEnabled || networkStatus.isServerRunning}
                    sx={{ mb: 2 }}
                    placeholder="http://192.168.1.10:3000"
                  />
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      onClick={handleConnectClient}
                      disabled={!networkStatus.isEnabled || networkStatus.isServerRunning || !clientServerUrl.trim() || !!networkStatus.isClientConnected}
                    >
                      Connect
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={handleDisconnectClient}
                      disabled={!networkStatus.isEnabled || !networkStatus.isClientConnected}
                    >
                      Disconnect
                    </Button>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Use this on Client PCs. Enter the Host URL shown on the Host PC and click Connect.
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Server Configuration
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      label="Server Port"
                      value="3000"
                      size="small"
                      disabled
                      sx={{ mb: 2, width: '100%' }}
                    />
                    {networkStatus.isServerRunning ? (
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={handleStopServer}
                      >
                        Stop Server
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="success"
                        onClick={handleStartServer}
                        disabled={!networkStatus.isEnabled || (isTauriRuntime() && !licenseState?.activated)}
                      >
                        Start Server
                      </Button>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Server must be running for multi-user access. {!networkStatus.isEnabled && 'Enable multi-user mode first.'}
                    {networkStatus.isEnabled && isTauriRuntime() && !licenseState?.activated && ' Activate Host license first.'}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Host License
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      label={licenseState?.activated ? 'Activated' : 'Not Activated'}
                      color={licenseState?.activated ? 'success' : 'default'}
                      size="small"
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      label="Machine ID"
                      value={licenseState?.machineId ?? ''}
                      size="small"
                      fullWidth
                      disabled
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      label="License Key"
                      value={licenseKeyInput}
                      onChange={(e) => setLicenseKeyInput(e.target.value)}
                      size="small"
                      fullWidth
                      disabled={licenseState?.activated || licenseLoading || activating}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      label="Activation Code"
                      value={activationCodeInput}
                      onChange={(e) => setActivationCodeInput(e.target.value)}
                      size="small"
                      fullWidth
                      disabled={licenseState?.activated || licenseLoading || activating}
                      sx={{ mb: 2 }}
                    />
                    {!licenseState?.activated && (
                      <Button variant="contained" onClick={handleActivateHost} disabled={licenseLoading || activating}>
                        Activate Host
                      </Button>
                    )}
                    {licenseError && (
                      <Box sx={{ mt: 2 }}>
                        <Alert severity="warning">{licenseError}</Alert>
                      </Box>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Activate only on the Host PC. Client PCs can connect over LAN without license.
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Network Status
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body1" sx={{ mr: 2 }}>
                      Server Status:
                    </Typography>
                    <Chip
                      label={networkStatus.isServerRunning ? "Running" : "Not Running"}
                      color={networkStatus.isServerRunning ? "success" : "default"}
                      size="small"
                    />
                  </Box>

                  {networkStatus.isServerRunning && networkStatus.serverUrl && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Server URL: <strong>{networkStatus.serverUrl}</strong>
                      </Typography>
                      <Typography variant="body2">
                        Local IP: <strong>{networkStatus.localIP || 'Detecting...'}</strong>
                      </Typography>
                    </Box>
                  )}

                  {networkStatus.connectedUsers.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Connected Users ({networkStatus.connectedUsers.length}):
                      </Typography>
                      {networkStatus.connectedUsers.map(user => (
                        <Chip
                          key={user.id}
                          label={`${user.name} (${user.role})`}
                          size="small"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                  )}
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Start the server to enable multi-user access over your local network.
                  </Typography>
                  <Alert severity="info">
                    For multi-user: Start Server on Host PC, then Connect from Client PCs.
                  </Alert>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}

        {activeTab === 8 && (
          canBackup || canRestore ? <BackupRestore /> : <Alert severity="error" sx={{ mt: 3 }}>You do not have permission to backup/restore</Alert>
        )}

        {activeTab === 9 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Layout
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Theme, accent colour, and how the app shell looks. Your choice is saved on this device.
            </Typography>
            <Grid container spacing={3}>
              <AppearanceSettingsSection />
            </Grid>
          </Box>
        )}

        {activeTab === 10 && (
          <Box sx={{ mt: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Financial Year & Date Lock
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Configure financial year limits and lock past dates to prevent editing or deleting old entries.
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Financial Year
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="FY Start"
                        type="date"
                        value={String(appSettings?.financialYear?.startDate ?? '')}
                        onChange={(e) => {
                          setAppSettings((p: any) => ({
                            ...p,
                            financialYear: { ...(p?.financialYear ?? {}), startDate: e.target.value },
                          }));
                          setAppSettingsSaved(false);
                        }}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="FY End"
                        type="date"
                        value={String(appSettings?.financialYear?.endDate ?? '')}
                        onChange={(e) => {
                          setAppSettings((p: any) => ({
                            ...p,
                            financialYear: { ...(p?.financialYear ?? {}), endDate: e.target.value },
                          }));
                          setAppSettingsSaved(false);
                        }}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Date Lock
                  </Typography>
                  <TextField
                    label="Lock entries up to (inclusive)"
                    type="date"
                    value={String(appSettings?.lockDate ?? '')}
                    onChange={(e) => {
                      setAppSettings((p: any) => ({ ...p, lockDate: e.target.value }));
                      setAppSettingsSaved(false);
                    }}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Leave empty to disable lock. If set, entries on or before the lock date cannot be created/edited/deleted.
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Module Toggles
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(appSettings?.features?.gstEnabled)}
                            onChange={(e) => {
                              setAppSettings((p: any) => ({
                                ...p,
                                features: { ...(p?.features ?? {}), gstEnabled: e.target.checked },
                              }));
                              setAppSettingsSaved(false);
                            }}
                          />
                        }
                        label="GST"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(appSettings?.features?.inventoryEnabled)}
                            onChange={(e) => {
                              setAppSettings((p: any) => ({
                                ...p,
                                features: { ...(p?.features ?? {}), inventoryEnabled: e.target.checked },
                              }));
                              setAppSettingsSaved(false);
                            }}
                          />
                        }
                        label="Inventory"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(appSettings?.features?.payrollEnabled)}
                            onChange={(e) => {
                              setAppSettings((p: any) => ({
                                ...p,
                                features: { ...(p?.features ?? {}), payrollEnabled: e.target.checked },
                              }));
                              setAppSettingsSaved(false);
                            }}
                          />
                        }
                        label="Payroll"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(appSettings?.features?.multiCurrencyEnabled)}
                            onChange={(e) => {
                              setAppSettings((p: any) => ({
                                ...p,
                                features: { ...(p?.features ?? {}), multiCurrencyEnabled: e.target.checked },
                              }));
                              setAppSettingsSaved(false);
                            }}
                          />
                        }
                        label="Multi-currency"
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Invoice Numbering (Manual)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Customize how your invoice numbers are generated. e.g., <strong>{appSettings?.invoiceNumbering?.prefix ?? 'INV-'}00{appSettings?.invoiceNumbering?.startingNumber ?? 1}{appSettings?.invoiceNumbering?.suffix ?? ''}</strong>
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Prefix"
                        value={appSettings?.invoiceNumbering?.prefix ?? ''}
                        onChange={(e) => {
                          setAppSettings((p: any) => ({
                            ...p,
                            invoiceNumbering: { ...(p?.invoiceNumbering ?? {}), prefix: e.target.value },
                          }));
                          setAppSettingsSaved(false);
                        }}
                        placeholder="e.g., INV-"
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Starting Number"
                        type="number"
                        value={appSettings?.invoiceNumbering?.startingNumber ?? 1}
                        onChange={(e) => {
                          setAppSettings((p: any) => ({
                            ...p,
                            invoiceNumbering: { ...(p?.invoiceNumbering ?? {}), startingNumber: parseInt(e.target.value) || 1 },
                          }));
                          setAppSettingsSaved(false);
                        }}
                        InputProps={{ inputProps: { min: 1 } }}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Suffix"
                        value={appSettings?.invoiceNumbering?.suffix ?? ''}
                        onChange={(e) => {
                          setAppSettings((p: any) => ({
                            ...p,
                            invoiceNumbering: { ...(p?.invoiceNumbering ?? {}), suffix: e.target.value },
                          }));
                          setAppSettingsSaved(false);
                        }}
                        placeholder="e.g., /2024"
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Button variant="contained" onClick={saveAppConfig} disabled={!canManageSettings}>
                    Save App Settings
                  </Button>
                  {appSettingsSaved && <Alert severity="success" sx={{ p: 0.5, px: 1 }}>Saved</Alert>}
                </Box>
                {appSettingsError && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="error">{appSettingsError}</Alert>
                  </Box>
                )}
              </Grid>
            </Grid>
          </Box>
        )}
    </Box>
  );
}