import { useEffect, useState, ChangeEvent, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Typography, Paper, Box, TextField, Button, Divider, Alert, Grid, Chip, Stack, Card } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import PrintCustomization from '../components/PrintCustomization';
import WhatsAppSettings from '../components/WhatsAppSettings';
import UserManagement from './UserManagement';
import AboutAndUpdates from '../components/AboutAndUpdates';
import BackupRestore from '../components/BackupRestore';
import { networkService, NetworkStatus } from '../services/networkService';
import { syncPasswordToFirestore } from '../services/userProfileService';
import { invoke } from '@tauri-apps/api/core';
import { usePermissions } from '../hooks/usePermissions';
import { isTauriRuntime, isElectronRuntime } from '../utils/runtime';
import { persistActiveCompanyLocalData } from '../services/companyRegistryService';
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
import { APP_DISPLAY_NAME } from '@/constants/appBranding';
import { settingsIdentityHeroGradient } from '../theme/authScreenChrome';
import CreateCompanyDialog from '../components/CreateCompanyDialog';
import CompanySelectScreen from '../components/CompanySelectScreen';
import { setDefaultCompany } from '../services/companyRegistryService';
import { getActiveCompanyId } from '../utils/companyStorage';
import { getSessionSettings, setSessionSettings } from '../services/sessionManager';
import SettingsShell, { SettingsSectionBlock } from '../components/settings/SettingsShell';
import GstEwayBillSettings from '../components/settings/GstEwayBillSettings';
import type { SettingsSectionId } from '../components/settings/settingsNavConfig';

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
  upiId: string;
  gstin: string;
}

interface CompanyMediaInfo {
  logo?: string;
  signature?: string;
}

export default function Settings() {
  const theme = useTheme();
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

  const [activeSection, setActiveSection] = useState<SettingsSectionId>('company');
  const location = useLocation();
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(networkService.getStatus());
  const [deskHint, setDeskHint] = useState('Open Company Profile and keep legal details updated.');
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [switchCompanyOpen, setSwitchCompanyOpen] = useState(false);
  const [sessionDaysDefault, setSessionDaysDefault] = useState(7);
  const [sessionDaysRemember, setSessionDaysRemember] = useState(30);
  const [sessionSettingsSaved, setSessionSettingsSaved] = useState(false);

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
      setActiveSection('network');
    } else if (t === 'about' || t === 'updates') {
      setActiveSection('about');
    } else if (t === 'companydesk' || t === 'companyops' || t === 'company' || t === 'profile') {
      setActiveSection('company');
    } else if (t === 'security') {
      setActiveSection('security');
    } else if (t === 'backup') {
      setActiveSection('backup');
    } else if (t === 'whatsapp') {
      setActiveSection('whatsapp');
    } else if (t === 'print') {
      setActiveSection('print');
    } else if (t === 'gst' || t === 'eway' || t === 'gst-eway') {
      setActiveSection('gst-eway');
    } else if (t === 'users') {
      setActiveSection('users');
    }
  }, [location.search, location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeSection !== 'company') return;
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setCreateCompanyOpen(true);
        setDeskHint('Create a new company with isolated data folder (PVE1002, PVE1003, …).');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'security') return;
    void getSessionSettings().then((s) => {
      setSessionDaysDefault(s.sessionDaysDefault);
      setSessionDaysRemember(s.sessionDaysRemember);
    });
  }, [activeSection]);

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
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  const [gatewayValidUntilMs, setGatewayValidUntilMs] = useState<number | null>(null);
  const [gatewayUpdatesEntitled, setGatewayUpdatesEntitled] = useState<boolean>(true);
  const [gatewayRenewUtr, setGatewayRenewUtr] = useState('');
  const [gatewayRenewSubmitting, setGatewayRenewSubmitting] = useState(false);
  const [gatewayRenewInfo, setGatewayRenewInfo] = useState<string | null>(null);
  const [gatewayRenewRequest, setGatewayRenewRequest] = useState<any | null>(null);


  const loadCompanyProfile = (): CompanyProfile => ({
    name: localStorage.getItem('companyName')?.trim() || APP_DISPLAY_NAME,
    address: localStorage.getItem('companyAddress')?.trim() || '',
    statePin: localStorage.getItem('companyStatePin')?.trim() || '',
    mobiles: localStorage.getItem('companyMobiles')?.trim() || '',
    email: localStorage.getItem('companyEmail')?.trim() || '',
    website: localStorage.getItem('companyWebsite')?.trim() || '',
    upiId: localStorage.getItem('companyUpiId')?.trim() || '',
    gstin: localStorage.getItem('companyGSTIN')?.trim() || '',
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
      if (enabled && !firestoreMultiUserLan) {
        setUpgradeDialogOpen(true);
        setUpgradeInfo('This license is currently Gold (single PC). Upgrade to Platinum for LAN multi-user.');
        return;
      }
      networkService.setEnabled(enabled);
      setNetworkStatus(networkService.getStatus());
      if (!enabled) {
        setLicenseError(null);
      }
    } catch (error) {
      console.error('Failed to toggle multi-user mode:', error);
      setLicenseError((error as any)?.message ?? 'Failed to toggle multi-user mode');
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
      const merged = { ...prev, ...partial };
      const normalizedName = String(merged?.name || merged?.businessName || localStorage.getItem('companyName') || '').trim();
      const next = { ...merged, name: normalizedName, businessName: normalizedName };
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
      try {
        localStorage.setItem('license_multi_user_lan', multiUserLan ? '1' : '0');
      } catch {
        // ignore
      }
      if (!multiUserLan) {
        try {
          networkService.setEnabled(false);
          await networkService.disconnect();
          setNetworkStatus(networkService.getStatus());
        } catch {
          // ignore
        }
      }
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
    if (activeSection !== 'network') return;
    void refreshNetworkLicenseFlags();
  }, [activeSection]);

  useEffect(() => {
    setSaved(false);
  }, [companyProfile]);

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

    const statePin = companyProfile.statePin.trim();
    const statePinParts = statePin.split(',').map((s) => s.trim()).filter(Boolean);
    const parsedCity = statePinParts[0] || '';
    const parsedState = (statePinParts[1] || '').replace(/\s*-?\s*\d{6}$/, '').trim();

    // Save to localStorage
    localStorage.setItem('companyName', companyProfile.name.trim());
    localStorage.setItem('companyAddress', companyProfile.address.trim());
    localStorage.setItem('companyStatePin', statePin);
    localStorage.setItem('companyMobiles', companyProfile.mobiles.trim());
    localStorage.setItem('companyEmail', companyProfile.email.trim());
    localStorage.setItem('companyWebsite', companyProfile.website.trim());
    localStorage.setItem('companyUpiId', companyProfile.upiId.trim());
    localStorage.setItem('companyGSTIN', companyProfile.gstin.trim());

    upsertCompanyInfo({
      name: companyProfile.name.trim(),
      businessName: companyProfile.name.trim(),
      address: companyProfile.address.trim(),
      phone: companyProfile.mobiles.trim(),
      email: companyProfile.email.trim(),
      upiId: companyProfile.upiId.trim(),
      gstin: companyProfile.gstin.trim(),
      city: parsedCity,
      state: parsedState,
      statePin,
      logo: companyMedia.logo ?? '',
      signature: companyMedia.signature ?? '',
    });

    void (async () => {
      const persisted = await persistActiveCompanyLocalData();
      if (!persisted.success && persisted.error) {
        console.warn('[Settings] company disk sync failed', persisted.error);
      }
    })();

    // Dispatch event for other components to update
    window.dispatchEvent(new Event('companyProfileUpdated'));
    setSaved(true);
    setErrors({});
    setIsEditing(false);
  };

  return (
    <>
      <SettingsShell
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onBackupNow={() => setActiveSection('backup')}
        onRestore={() => setActiveSection('backup')}
        onAddUser={() => setActiveSection('users')}
        canBackup={canBackup}
        canRestore={canRestore}
        canManageUsers={canManageUsers}
      >
      {activeSection === 'company' && (
        <Box sx={{ p: 0, mx: { xs: -2, md: -3 }, mt: { xs: -2, md: -3 } }}>
          <Box sx={{ 
            p: { xs: 2.5, md: 3 }, 
            background: settingsIdentityHeroGradient(theme), 
            color: theme.palette.primary.contrastText,
            borderRadius: 0,
            mb: 3,
            boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`
          }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h5" fontWeight={900}>Company Identity</Typography>
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
                    bgcolor: alpha(theme.palette.background.paper, 0.2),
                    backdropFilter: 'blur(10px)',
                    '&:hover': { bgcolor: alpha(theme.palette.background.paper, 0.3) },
                    transition: 'all 0.2s ease',
                  }}
                >
                  Edit Profile
                </Button>
              )}
            </Stack>
          </Box>

          <Grid container spacing={3} sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            <Grid item xs={12} md={4}>
              <Stack spacing={3}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 3, borderRadius: 4 }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={700} gutterBottom>
                    COMPANY LOGO
                  </Typography>
                  <Box sx={{ 
                    width: '100%', 
                    height: 200, 
                    border: '2px dashed var(--border)',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'var(--bg-section)',
                    mb: 2,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
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
                    border: '2px dashed var(--border)',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'var(--bg-section)',
                    mb: 2,
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
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
                    <TextField
                      label="UPI ID (for invoice QR)"
                      value={companyProfile.upiId}
                      onChange={(e) => handleFieldChange('upiId', e.target.value)}
                      fullWidth
                      placeholder="yourname@upi"
                      helperText="Shown as Scan to Pay QR on printed invoices when set"
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
                      { label: 'UPI ID', value: companyProfile.upiId, icon: '💳' },
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
            <Alert severity="success" sx={{ mx: { xs: 2, md: 3 }, mb: 3, borderRadius: 3 }}>
              Company profile updated successfully!
            </Alert>
          )}
{licenseError && (
            <Alert severity="error" sx={{ mx: { xs: 2, md: 3 }, mb: 3, borderRadius: 3 }}>
              {licenseError}
            </Alert>
          )}

          <Divider sx={{ my: 3, mx: { xs: 2, md: 3 } }} />
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
            <SettingsSectionBlock title="Company Operations" subtitle="Create, switch, or set the default company.">
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                <Button variant="contained" onClick={() => setCreateCompanyOpen(true)}>
                  Create New Company (Alt+Shift+N)
                </Button>
                <Button variant="outlined" onClick={() => setSwitchCompanyOpen(true)}>
                  Switch Company
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    void (async () => {
                      try {
                        const id = getActiveCompanyId();
                        await setDefaultCompany(id);
                        setDeskHint(`${id} is now the default company when you open the app.`);
                      } catch (e: unknown) {
                        setDeskHint(String((e as Error)?.message ?? 'Failed to set default company'));
                      }
                    })();
                  }}
                >
                  Set Current as Default
                </Button>
              </Stack>
            </SettingsSectionBlock>
            <SettingsSectionBlock title="Your Companies">
              <Alert severity="info" sx={{ mb: 2 }}>
                {deskHint} Open a company, set default, or use <strong>Delete Company</strong> on each card.
              </Alert>
              <CompanySelectScreen mode="embedded" open={activeSection === 'company'} />
            </SettingsSectionBlock>
          </Box>
        </Box>
      )}

      {activeSection === 'about' && <AboutAndUpdates />}

        {activeSection === 'print' && (
          canCustomizePrint ? <PrintCustomization /> : <Alert severity="error" sx={{ mt: 3 }}>You do not have permission to customize print</Alert>
        )}

        {activeSection === 'gst-eway' && (
          <SettingsSectionBlock title="GST & E-Way Bill">
            <GstEwayBillSettings />
          </SettingsSectionBlock>
        )}

        {activeSection === 'whatsapp' && (
          <WhatsAppSettings />
        )}

        {activeSection === 'users' && (
          canManageUsers ? <UserManagement /> : <Alert severity="error" sx={{ mt: 3 }}>You do not have permission to manage users</Alert>
        )}

        {activeSection === 'security' && (
          <Box>
            <SettingsSectionBlock title="Change Password">
              <PasswordChangeForm />
            </SettingsSectionBlock>
            <Divider sx={{ my: 3 }} />
            <SettingsSectionBlock title="Session & Login" subtitle="Control how long you stay signed in on this PC.">
              <Paper sx={{ p: 3, border: '1px solid var(--border)', maxWidth: 480 }}>
                <Stack spacing={2}>
                  <TextField
                    label="Default session (days)"
                    type="number"
                    size="small"
                    value={sessionDaysDefault}
                    onChange={(e) => setSessionDaysDefault(Number(e.target.value) || 7)}
                    inputProps={{ min: 1, max: 365 }}
                    helperText="Used when Remember me is off (default 7 days)"
                  />
                  <TextField
                    label="Remember me session (days)"
                    type="number"
                    size="small"
                    value={sessionDaysRemember}
                    onChange={(e) => setSessionDaysRemember(Number(e.target.value) || 30)}
                    inputProps={{ min: 1, max: 365 }}
                    helperText="Used when Remember me is checked on login (default 30 days)"
                  />
                  <Button
                    variant="contained"
                    onClick={() => {
                      void setSessionSettings({
                        sessionDaysDefault,
                        sessionDaysRemember,
                      }).then(() => setSessionSettingsSaved(true));
                    }}
                  >
                    Save security settings
                  </Button>
                  {sessionSettingsSaved && (
                    <Alert severity="success" onClose={() => setSessionSettingsSaved(false)}>
                      Session settings saved.
                    </Alert>
                  )}
                </Stack>
              </Paper>
            </SettingsSectionBlock>
          </Box>
        )}

        {activeSection === 'network' && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              LAN Multi-User (network mode)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Multi-user access works only over LAN. Run one PC as Host server and connect other PCs as Clients.
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
                    License use stays valid. Gateway covers updates/new features. Renew via UPI when expired.
                  </Typography>
                  {gatewayValidUntilMs != null ? (
                    <Alert severity={gatewayUpdatesEntitled ? 'success' : 'warning'} sx={{ mb: 2 }}>
                      <strong>Valid until:</strong> {new Date(gatewayValidUntilMs).toLocaleString()}
                    </Alert>
                  ) : (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Open app online once to sync Gateway validity from cloud.
                    </Alert>
                  )}
                  {gatewayRenewRequest?.status === 'pending' && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Renewal pending verification (UTR: {String(gatewayRenewRequest.utr ?? '')}).
                    </Alert>
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
                      <Box
                        component="img"
                        src={gatewayUpiQrImageUrl(220)}
                        alt="Gateway renewal UPI QR"
                        sx={{ width: 220, height: 220, border: 1, borderColor: 'divider', borderRadius: 1 }}
                      />
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
                      />
                      <Button
                        variant="contained"
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
                    Single to Multi-user LAN upgrade
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Chip
                      size="small"
                      color={firestoreMultiUserLan ? 'success' : 'warning'}
                      label={firestoreMultiUserLan ? 'Platinum license (LAN unlocked)' : 'Gold license (single PC)'}
                    />
                  </Stack>
                  {!firestoreMultiUserLan ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
                        <Box
                          component="img"
                          src={multiUserUpiQrImageUrl(220)}
                          alt="UPI payment QR"
                          sx={{ width: 220, height: 220, border: 1, borderColor: 'divider', borderRadius: 1 }}
                        />
                      <Box sx={{ flex: '1 1 240px', minWidth: 240 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          UPI ID: <strong>{MULTI_USER_UPI_PAYEE}</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          Amount: <strong>₹11,800.00</strong> ({MULTI_USER_PRICING_LABEL})
                        </Typography>
                        <TextField
                          label="UTR after payment"
                          value={upgradeUtr}
                          onChange={(e) => setUpgradeUtr(e.target.value)}
                          size="small"
                          fullWidth
                          sx={{ mb: 2 }}
                        />
                        <Button
                          variant="contained"
                          color="success"
                          onClick={() => void handleSubmitMultiUserUpgrade()}
                          disabled={upgradeSubmitting}
                        >
                          Submit UTR for approval
                        </Button>
                  {upgradeInfo && (
                    <Alert severity={upgradeInfo.includes('sent') ? 'success' : 'warning'} sx={{ mt: 2 }}>
                      {upgradeInfo}
                    </Alert>
                        )}
                      </Box>
                    </Box>
                  ) : (
                    <Alert severity="success">LAN multi-user is active on this license.</Alert>
                  )}
                  <Button variant="outlined" size="small" sx={{ mt: 2 }} onClick={() => void refreshNetworkLicenseFlags()}>
                    Refresh status
                  </Button>
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
                    disabled={networkStatus.isServerRunning}
                    sx={{ mb: 2 }}
                    placeholder="http://192.168.1.10:3000"
                  />
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      onClick={async () => {
                        if (!networkStatus.isEnabled) {
                          await handleMultiUserToggle(true);
                        }
                        await handleConnectClient();
                      }}
                      disabled={networkStatus.isServerRunning || !clientServerUrl.trim() || !!networkStatus.isClientConnected}
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
                    Use this on Client PCs. Enter Host URL and click Connect.
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
                        onClick={async () => {
                          if (!networkStatus.isEnabled) {
                            await handleMultiUserToggle(true);
                          }
                          await handleStartServer();
                        }}
                        disabled={isTauriRuntime() && !licenseState?.activated}
                      >
                        Start Server
                      </Button>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    LAN multi-user runs only with Host server + Client connection.
                    {isTauriRuntime() && !licenseState?.activated && ' Activate Host license first.'}
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
                    Start Host server on one PC and connect Client PCs over LAN.
                  </Typography>
                  <Alert severity="info">
                    For multi-user: Start Server on Host PC, then Connect from Client PCs.
                  </Alert>
                  {licenseError && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      {licenseError}
                    </Alert>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}

        {activeSection === 'backup' && (
          canBackup || canRestore ? <BackupRestore /> : <Alert severity="error" sx={{ mt: 3 }}>You do not have permission to backup/restore</Alert>
        )}

      </SettingsShell>
      <CreateCompanyDialog open={createCompanyOpen} onClose={() => setCreateCompanyOpen(false)} />
      <CompanySelectScreen mode="switch" open={switchCompanyOpen} onClose={() => setSwitchCompanyOpen(false)} />
    </>
  );
}