// D:\PVEB\desktop\src\App.tsx
// AuthContext-based routing (no Redux auth here)

import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { APP_DISPLAY_NAME } from "@/constants/appBranding";

import Layout from "./components/Layout";
import RequirePermission from "./components/RequirePermission";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PartyForm from "./pages/Parties/PartyForm";
import PartyLedgerReport from "./pages/PartyLedgerReport";
import OutstandingAgingReport from "./pages/Reports/OutstandingAgingReport";
import LowStockReport from "./pages/Reports/LowStockReport";
import LedgerStatementByLedgerId from "./pages/LedgerStatementByLedgerId";
import PurchaseInvoices from "./pages/PurchaseInvoices";
import DebitNotes from "./pages/DebitNotes";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import GSTReports from "./pages/GST/GSTReports";
import GSTR1Report from "./pages/GST/GSTR1Report";
import GSTR2Report from "./pages/GST/GSTR2Report";
import GSTR3BReport from "./pages/GST/GSTR3BReport";
import GSTR9Report from "./pages/GST/GSTR9Report";
import HSNSummary from "./pages/GST/HSNSummary";
import ManualExpenseEntry from "./pages/Expenses/ManualExpenseEntry";
import Payments from "./pages/Payments";
import PrintWindow from "./pages/PrintWindow";
import ConnectToHost from "./pages/ConnectToHost";
import { useState, useEffect, useRef, lazy, Suspense, useMemo, useCallback } from "react";
import BusinessProfile from "./pages/BusinessProfile";
import Schemes from "./pages/Schemes";
import SmartSchemeForm from "./pages/Schemes/SmartSchemeForm";
import RetailerSchemeDashboard from "./pages/Schemes/RetailerSchemeDashboard";
import OverdueTracker from "./pages/Schemes/OverdueTracker";
import LedgerAccountList from "./pages/Masters/LedgerAccounts/LedgerAccountList";
import LedgerAccountForm from "./pages/Masters/LedgerAccounts/LedgerAccountForm";
import InventoryItemList from "./pages/Masters/InventoryItems/InventoryItemList";
import InventoryItemForm from "./pages/Masters/InventoryItems/InventoryItemForm";
import GodownList from "./pages/Masters/Godowns/GodownList";
import ImportFromErp from "./pages/ImportFromErp";
import ApprovalPendingPage from "./pages/Approvals/ApprovalPendingPage";
import GodownForm from "./pages/Masters/Godowns/GodownForm";
import BankLedgerList from "./pages/Masters/LedgerAccounts/BankLedgerList";
import { ItemsModuleShell } from "./components/items/ItemsModuleShell";
import ItemsWorkspace from "./pages/items/ItemsWorkspace";
import { CustomersModuleShell } from "./components/customers/CustomersModuleShell";
import CustomersListPage from "./pages/customers/CustomersListPage";
import CustomerDetailPage from "./pages/customers/CustomerDetailPage";
import BankingHub from "./pages/hubs/BankingHub";
import { SalesManagementShell } from "./components/sales/SalesManagementShell";
import SalesDocumentPage from "./pages/sales/SalesDocumentPage";
import CollectionFormPage from "./pages/sales/CollectionFormPage";
import SalesPipelineForm from "./pages/sales/SalesPipelineForm";
import { PurchaseManagementShell } from "./components/purchase/PurchaseManagementShell";
import PurchaseDocumentPage from "./pages/purchase/PurchaseDocumentPage";
import InventoryItemDetail from "./pages/Masters/InventoryItems/InventoryItemDetail";
import PriceListList from "./pages/Masters/PriceLists/PriceListList";
import PriceListForm from "./pages/Masters/PriceLists/PriceListForm";
import StockAdjustmentList from "./pages/Masters/StockAdjustments/StockAdjustmentList";
import StockAdjustmentForm from "./pages/Masters/StockAdjustments/StockAdjustmentForm";
import SalesVoucherList from "./pages/Vouchers/Sales/SalesVoucherList";
import SalesVoucherForm from "./pages/Vouchers/Sales/SalesVoucherForm";
import SalesReturnVoucherList from "./pages/Vouchers/SalesReturn/SalesReturnVoucherList";
import SalesReturnVoucherForm from "./pages/Vouchers/SalesReturn/SalesReturnVoucherForm";
import PurchaseVoucherList from "./pages/Vouchers/Purchase/PurchaseVoucherList";
import PurchaseVoucherForm from "./pages/Vouchers/Purchase/PurchaseVoucherForm";
import PurchaseReturnVoucherList from "./pages/Vouchers/PurchaseReturn/PurchaseReturnVoucherList";
import PurchaseReturnVoucherForm from "./pages/Vouchers/PurchaseReturn/PurchaseReturnVoucherForm";
import PaymentVoucherList from "./pages/Vouchers/Payment/PaymentVoucherList";
import ReceiptVoucherList from "./pages/Vouchers/Receipt/ReceiptVoucherList";
import JournalVoucherList from "./pages/Vouchers/Journal/JournalVoucherList";
import JournalVoucherForm from "./pages/Vouchers/Journal/JournalVoucherForm";
import VouchersHub from "./pages/Vouchers/VouchersHub";
import MoneyVouchersHub from "./pages/Vouchers/MoneyVouchersHub";

import { useAuth } from "./pages/contexts/auth";
import FocusProvider from "./contexts/FocusProvider";
import SetupWizard from "./components/SetupWizard";
const Activate = lazy(() => import('./pages/Activate'));
const PaymentVoucherPage = lazy(() => import('./pages/Vouchers/PaymentReceipt/PaymentVoucher'));
import { invoke } from "@tauri-apps/api/core";
import { networkService } from "./services/networkService";
import { detectDeviceChange, forceLogoutDueToDeviceChange, subscribeToLicenseDeactivation } from "./services/deviceChangeDetector";
import { validateLicenseAndDevice } from "./services/loginService";
import { syncHostMultiUserLanFromCloud } from "./services/hostLicenseSyncService";
import { db } from "./firebase/firebase";
import { doc, deleteField, onSnapshot, updateDoc } from "firebase/firestore";
import {
  fetchAppRelease,
  getBundledAppVersion,
  isOlderVersion,
  resolveDownloadUrl,
} from "./services/appUpdateService";
import { openExternalUrl } from "./services/printService";
import { isElectronRuntime } from "./utils/runtime";
import {
  applyCompanySwitch,
  ensureCompaniesInitialized,
  getActiveCompanyPayload,
  listCompaniesEnriched,
  switchCompany,
} from "./services/companyRegistryService";
import CompanySelectScreen from "./components/CompanySelectScreen";
import { withTimeout } from "./utils/withTimeout";

const isBusinessProfileSavedLocally = () => {
  try {
    const setupCompleted = localStorage.getItem('setupCompleted') === 'true';
    const raw = localStorage.getItem('company-info');
    const parsed = raw ? JSON.parse(raw) : {};
    const businessName = String(parsed?.businessName || parsed?.name || localStorage.getItem('companyName') || '').trim();
    const address = String(parsed?.address || localStorage.getItem('companyAddress') || '').trim();
    const phone = String(parsed?.phone || localStorage.getItem('companyPhone') || '').trim();
    return setupCompleted || Boolean(businessName && address && phone);
  } catch {
    return localStorage.getItem('setupCompleted') === 'true';
  }
};

function App() {
  console.log("📱 App (AuthContext version) rendering...");

  const { isAuthenticated, loading, user, logout } = useAuth();

  useEffect(() => {
    const onCompanyReady = () => setCompanyGate('ready');
    window.addEventListener('companyGateReady', onCompanyReady);
    return () => window.removeEventListener('companyGateReady', onCompanyReady);
  }, []);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [deviceCheckDone, setDeviceCheckDone] = useState(false);
  const [licenseCheckDone, setLicenseCheckDone] = useState(false);
  const [licenseValid, setLicenseValid] = useState(false);
  const [licenseCheckReason, setLicenseCheckReason] = useState<string>('');
  const [profileCompletedLocal, setProfileCompletedLocal] = useState<boolean>(isBusinessProfileSavedLocally());
  const profileCompleted = Boolean((user as any)?.completedBusinessProfile || profileCompletedLocal);
  const [hostCheck, setHostCheck] = useState<{ checking: boolean; ok: boolean; serverUrl?: string; error?: string }>({
    checking: false,
    ok: true,
  });
  const [adminUpdateNotice, setAdminUpdateNotice] = useState<any | null>(null);
  const [adminPopupBusy, setAdminPopupBusy] = useState(false);
  const [adminPopupReleaseNotes, setAdminPopupReleaseNotes] = useState('');
  const licenseCheckGeneration = useRef(0);
  const [companyGate, setCompanyGate] = useState<'loading' | 'select' | 'ready'>('loading');

  useEffect(() => {
    if (!isAuthenticated) {
      setLicenseCheckDone(false);
      setLicenseValid(false);
      setLicenseCheckReason('');
      setProfileCompletedLocal(isBusinessProfileSavedLocally());
      setCompanyGate('loading');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !licenseValid || !licenseCheckDone) {
      setCompanyGate('loading');
      return;
    }
    if (!isElectronRuntime()) {
      setCompanyGate('ready');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await ensureCompaniesInitialized();
        const res = await listCompaniesEnriched();
        const def = res.defaultCompany;
        const target = def ? res.companies.find((c) => c.id === def) : undefined;
        if (def && target?.folderOk) {
          if (res.activeId !== def) {
            const active = await switchCompany(def);
            await applyCompanySwitch(active);
          }
          if (!cancelled) setCompanyGate('ready');
          return;
        }
        if (!cancelled) setCompanyGate('select');
      } catch (e) {
        console.warn('[companies] gate failed', e);
        if (!cancelled) setCompanyGate('select');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, licenseValid, licenseCheckDone]);

  useEffect(() => {
    if (!isAuthenticated || !isElectronRuntime()) return;
    let cancelled = false;
    void (async () => {
      try {
        await ensureCompaniesInitialized();
        const active = await getActiveCompanyPayload();
        if (cancelled || !active) return;
        await applyCompanySwitch(active);
      } catch (e) {
        console.warn('[companies] bootstrap failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const syncProfileFlag = () => setProfileCompletedLocal(isBusinessProfileSavedLocally());
    syncProfileFlag();
    window.addEventListener('companyProfileUpdated', syncProfileFlag as EventListener);
    window.addEventListener('storage', syncProfileFlag as EventListener);
    return () => {
      window.removeEventListener('companyProfileUpdated', syncProfileFlag as EventListener);
      window.removeEventListener('storage', syncProfileFlag as EventListener);
    };
  }, []);

  const isTauriRuntime = () => {
    try {
      if ((window as any).__TAURI__ != null) return true;
      if ((window as any).__TAURI_INTERNALS__ != null) return true;
      if ((window as any).__TAURI_IPC__ != null) return true;
      if ((window as any).__TAURI_METADATA__ != null) return true;
      if ((navigator as any)?.userAgent && String((navigator as any).userAgent).toLowerCase().includes('tauri')) return true;
      if (window.location.hostname === 'tauri.localhost') return true;
      const p = window.location.protocol;
      return p === 'tauri:' || p === 'file:';
    } catch {
      return false;
    }
  };

  const protocol = window.location.protocol;
  const isElectron = navigator.userAgent.toLowerCase().includes('electron') || (window as any)?.process?.type === 'renderer';
  const Router = isTauriRuntime() || isElectron || protocol === 'file:' ? HashRouter : BrowserRouter;

  const exitMultiUserClientMode = () => {
    networkService.setEnabled(false);
    void networkService.disconnect();
  };

  const navigateInApp = (path: string, search?: string) => {
    const p = path.startsWith("/") ? path : `/${path}`;
    const q = search ? `?${search}` : "";
    if (Router === HashRouter) {
      window.location.hash = `#${p}${q}`;
    } else {
      window.location.assign(`${p}${q}`);
    }
  };

  console.log("🔐 AuthContext:", {
    isAuthenticated,
    loading,
    hasUser: !!user,
    isElectron,
    protocol,
  });

  // Admin-sent update popup (Firestore: users/{email}.adminUpdateNotice)
  useEffect(() => {
    if (!db) return;
    const email = String((user as any)?.email ?? "").trim().toLowerCase();
    if (!isAuthenticated || !email) {
      setAdminUpdateNotice(null);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "users", email),
      (snap) => {
        const d = snap.exists() ? (snap.data() as any) : null;
        const notice = d?.adminUpdateNotice ?? null;
        setAdminUpdateNotice(notice || null);
      },
      () => {
        // ignore
      }
    );
    return () => unsub();
  }, [isAuthenticated, user]);

  const userEmailLower = String((user as any)?.email ?? '').trim().toLowerCase();

  const dismissAdminUpdateNotice = useCallback(async () => {
    const rv = String(adminUpdateNotice?.requiredVersion ?? '').trim();
    if (userEmailLower && rv) {
      try {
        localStorage.setItem(`pve_admin_update_dismissed_${userEmailLower}_${rv}`, '1');
      } catch {
        // ignore
      }
    }
    setAdminUpdateNotice(null);
    try {
      sessionStorage.removeItem('pve_has_admin_update_notice');
      window.dispatchEvent(new Event('pve-update-notice-changed'));
    } catch {
      // ignore
    }
    if (db && userEmailLower) {
      try {
        await updateDoc(doc(db, 'users', userEmailLower), { adminUpdateNotice: deleteField() });
      } catch (e) {
        console.warn('[update-notice] clear failed', e);
      }
    }
  }, [adminUpdateNotice, userEmailLower]);

  useEffect(() => {
    if (!isAuthenticated || !adminUpdateNotice) {
      setAdminPopupReleaseNotes('');
      return;
    }
    const cur = getBundledAppVersion();
    const rv = String(adminUpdateNotice?.requiredVersion ?? '').trim();
    const dismissed =
      Boolean(userEmailLower && rv) &&
      localStorage.getItem(`pve_admin_update_dismissed_${userEmailLower}_${rv}`) === '1';
    const shouldShow =
      !dismissed && (!rv || isOlderVersion(cur, rv));
    if (!shouldShow) {
      setAdminPopupReleaseNotes('');
      return;
    }
    const fromNotice = String(adminUpdateNotice?.releaseNotes ?? '').trim();
    if (fromNotice) {
      setAdminPopupReleaseNotes(fromNotice);
      return;
    }
    void fetchAppRelease().then((info) => {
      setAdminPopupReleaseNotes(String(info?.releaseNotes ?? '').trim());
    });
  }, [isAuthenticated, adminUpdateNotice, userEmailLower]);

  useEffect(() => {
    if (!isAuthenticated) {
      try {
        sessionStorage.removeItem('pve_has_admin_update_notice');
        window.dispatchEvent(new Event('pve-update-notice-changed'));
      } catch {
        // ignore
      }
      return;
    }
    const cur = getBundledAppVersion();
    const rv = String(adminUpdateNotice?.requiredVersion ?? '').trim();
    const dismissed =
      Boolean(userEmailLower && rv) &&
      localStorage.getItem(`pve_admin_update_dismissed_${userEmailLower}_${rv}`) === '1';
    const bellActive = Boolean(
      adminUpdateNotice && !dismissed && (!rv || isOlderVersion(cur, rv))
    );
    try {
      if (bellActive) {
        sessionStorage.setItem('pve_has_admin_update_notice', '1');
      } else {
        sessionStorage.removeItem('pve_has_admin_update_notice');
      }
      window.dispatchEvent(new Event('pve-update-notice-changed'));
    } catch {
      // ignore
    }
  }, [isAuthenticated, adminUpdateNotice, userEmailLower]);

  // License validation on app startup
  useEffect(() => {
    let cancelled = false;
    const gen = ++licenseCheckGeneration.current;

    const checkLicense = async () => {
      if (!isAuthenticated || licenseCheckDone) return;

      console.log('🔍 Starting license validation check...');
      
      try {
        const result = await withTimeout(validateLicenseAndDevice(), 20000, {
          isValid: false,
          needsActivation: true,
          reason: 'License check timed out. Sign in again or check your internet connection.',
        });

        if (cancelled || gen !== licenseCheckGeneration.current) return;

        console.log('🔍 License validation result:', result);
        
        if (result.isValid) {
          console.log('✅ License validation passed');
          setLicenseValid(true);
          setLicenseCheckReason('');
          try {
            localStorage.setItem('license_multi_user_lan', result.multiUserLan ? '1' : '0');
          } catch {
            // ignore
          }
          if (!result.multiUserLan) {
            try {
              networkService.setEnabled(false);
              await networkService.disconnect();
            } catch {
              // ignore
            }
          }
          void syncHostMultiUserLanFromCloud(Boolean(result.multiUserLan));
          void import('./services/userActivityService').then(({ startUsageTracking }) =>
            startUsageTracking()
          );
        } else {
          console.log('❌ License validation failed:', result.reason);
          setLicenseValid(false);
          setLicenseCheckReason(result.reason || 'License validation failed');
          try {
            localStorage.setItem('license_multi_user_lan', '0');
          } catch {
            // ignore
          }
          void syncHostMultiUserLanFromCloud(false);

          // Do not send users to #/activate while still "signed in" — they get stuck and Back to Login breaks
          // (HashRouter desync when hash is set via window.location). Sign out and open Login; user uses "Activate licence" from there.
          if (result.needsActivation) {
            console.log('🔄 License needs setup — signing out to Login screen');
            setLicenseCheckDone(true);
            try {
              localStorage.setItem(
                'license_gate_message',
                result.reason === 'No license found'
                  ? 'Sign in with your email and password, or tap Activate licence if you are new.'
                  : String(result.reason || 'Complete licence setup from the Login screen.')
              );
            } catch {
              // ignore
            }
            logout();
            window.location.hash = '#/login';
            return;
          }
        }

        setLicenseCheckDone(true);
      } catch (error) {
        console.error('❌ License check error:', error);
        if (!cancelled && gen === licenseCheckGeneration.current) {
          setLicenseValid(false);
          setLicenseCheckReason('License check failed');
          setLicenseCheckDone(true);
        }
      }
    };

    void checkLicense();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, licenseCheckDone, logout]);

  // Device change detection on app startup
  useEffect(() => {
    let cancelled = false;

    const checkDeviceChange = async () => {
      if (!isAuthenticated || deviceCheckDone) return;

      try {
        const result = await detectDeviceChange();
        
        if (cancelled) return;

        if (result.changed) {
          console.warn('🚨 Device change detected:', result.reason);
          await forceLogoutDueToDeviceChange(result.reason || 'Device hardware or installation changed');
          logout();
          window.location.hash = '#/login';
        } else {
          setDeviceCheckDone(true);
        }
      } catch (error) {
        console.error('Device check error:', error);
        // On error, allow app to continue but mark check as done
        if (!cancelled) setDeviceCheckDone(true);
      }
    };

    checkDeviceChange();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, deviceCheckDone, logout]);

  // Firestore listener for remote deactivation (device transfer)
  useEffect(() => {
    if (!isAuthenticated) return;

    // License key is stored inside encrypted cache; we don't want to decrypt
    // here on every render. Instead, the backend/deviceChangeDetector will
    // compare machine IDs and trigger logout via the subscription.
    // For now, we rely on loginService.validateLicenseAndDevice + listener
    // keyed by the last known activation key saved alongside the user.
    const usersRaw = localStorage.getItem('gst_billing_users');
    let licenseKey: string | null = null;
    try {
      const users = usersRaw ? JSON.parse(usersRaw) as any[] : [];
      const u = users[0];
      if (u && u.activationKey) {
        licenseKey = String(u.activationKey);
      }
    } catch {
      licenseKey = null;
    }

    if (!licenseKey) return;

    const unsubscribe = subscribeToLicenseDeactivation({
      licenseKey,
      onDeactivated: async (reason) => {
        await forceLogoutDueToDeviceChange(reason);
        logout();
        try {
          localStorage.setItem('license_gate_message', String(reason || 'Session ended. Sign in again.'));
        } catch {
          /* ignore */
        }
        window.location.hash = '#/login';
      },
    });

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, logout]);

  // Check if setup is completed
  useEffect(() => {
    const isSetupCompleted = localStorage.getItem('setupCompleted') === 'true';
    const hasCompanyName = !!localStorage.getItem('companyName');

    if (!isSetupCompleted && !hasCompanyName && isAuthenticated && profileCompleted) {
      setShowSetupWizard(true);
    } else {
      setSetupCompleted(true);
    }
  }, [isAuthenticated, profileCompleted]);

  useEffect(() => {
    if (!loading && isTauriRuntime()) {
      invoke('close_splashscreen').catch(() => {
        // ignore
      });
    }
  }, [loading]);

  useEffect(() => {
    let cancelled = false;

    const readConfig = () => {
      try {
        const raw = localStorage.getItem('network_config');
        return raw ? (JSON.parse(raw) as any) : null;
      } catch {
        return null;
      }
    };

    const check = async () => {
      if (!isAuthenticated || !setupCompleted) return;
      const cfg = readConfig();
      if (!cfg || !cfg.enabled) {
    if (!cancelled) setHostCheck({ checking: false, ok: true });
    return;
  }
      const enabled = !!cfg?.enabled;
      const isServer = !!cfg?.isServer;
      const serverUrl = String(cfg?.serverUrl ?? '').trim();

      if (!enabled || isServer) {
        if (!cancelled) setHostCheck({ checking: false, ok: true, serverUrl });
        return;
      }

      if (!serverUrl) {
        if (!cancelled) setHostCheck({ checking: false, ok: false, serverUrl, error: 'Host URL not set' });
        return;
      }

      if (!cancelled) setHostCheck({ checking: true, ok: false, serverUrl });
      try {
        const ok = await (async () => {
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
        })();

        if (!cancelled) {
          setHostCheck({ checking: false, ok, serverUrl, error: ok ? undefined : 'Host offline or not reachable' });
        }
      } catch {
        if (!cancelled) {
          setHostCheck({ checking: false, ok: false, serverUrl, error: 'Host offline or not reachable' });
        }
      }
    };

    check();

    const onCfg = () => {
      check();
    };
    window.addEventListener('networkConfigUpdated', onCfg as any);
    window.addEventListener('storage', onCfg as any);

    return () => {
      cancelled = true;
      window.removeEventListener('networkConfigUpdated', onCfg as any);
      window.removeEventListener('storage', onCfg as any);
    };
  }, [isAuthenticated, setupCompleted]);

  // Setup wizard handlers
  const handleSetupComplete = (companyData: any) => {
    console.log('Setup completed with data:', companyData);
    setShowSetupWizard(false);
    setSetupCompleted(true);
    // Force a reload to ensure all components get the updated data
    window.location.reload();
  };

  const handleRestoreBackup = (backupPath: string) => {
    console.log('Restoring backup from:', backupPath);
    setShowSetupWizard(false);
    setSetupCompleted(true);
    // In a real implementation, you would restore the backup here
    // For now, just mark setup as completed
    localStorage.setItem('setupCompleted', 'true');
    localStorage.setItem('setupCompletedDate', new Date().toISOString());
    window.location.reload();
  };

  // AuthProvider jab localStorage se state load kar raha// Show loading while checking authentication and license
  if (loading || (!licenseCheckDone && isAuthenticated)) {
    return (
        <Box sx={{
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%',
          flexDirection: 'column',
          gap: 2
        }}>
          <CircularProgress size={60} />
          <Typography variant="h6">Loading {APP_DISPLAY_NAME}...</Typography>
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Checking authentication...' : 'Validating license...'}
          </Typography>
        </Box>
    );
  }

  const currentVersion = getBundledAppVersion();
  const requiredVersion = String(adminUpdateNotice?.requiredVersion ?? "").trim();
  const adminDownloadUrl = String(adminUpdateNotice?.downloadUrl ?? "").trim();
  const adminNoticeDismissedLocally =
    Boolean(userEmailLower && requiredVersion) &&
    localStorage.getItem(`pve_admin_update_dismissed_${userEmailLower}_${requiredVersion}`) === '1';
  const showAdminUpdatePopup = Boolean(
    adminUpdateNotice &&
    !adminNoticeDismissedLocally &&
    (!requiredVersion || isOlderVersion(currentVersion, requiredVersion))
  );

  const openAdminUpdateDownload = async () => {
    const url = adminDownloadUrl || resolveDownloadUrl(null);
    await dismissAdminUpdateNotice();
    await openExternalUrl(url);
  };

  const handleAdminCheckForUpdate = async () => {
    setAdminPopupBusy(true);
    try {
      const notes =
        adminPopupReleaseNotes || String(adminUpdateNotice?.releaseNotes ?? '').trim();
      if (notes) {
        try {
          localStorage.setItem('pve_pending_release_notes', notes);
        } catch {
          // ignore
        }
      }
      if (requiredVersion) {
        try {
          localStorage.setItem('pve_pending_update_version', requiredVersion);
        } catch {
          // ignore
        }
      }
      try {
        localStorage.setItem('auto_check_updates_once', '1');
      } catch {
        // ignore
      }
      await dismissAdminUpdateNotice();
      navigateInApp('/settings', 'tab=about');
    } finally {
      setAdminPopupBusy(false);
    }
  };

  return (
    <>
      {showAdminUpdatePopup && (
        <Dialog
          open
          onClose={() => {
            void dismissAdminUpdateNotice();
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>{String(adminUpdateNotice?.title ?? "Update available")}</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              {String(
                adminUpdateNotice?.message ??
                  "A newer version is available. Please update the software."
              )}
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: adminPopupReleaseNotes ? 2 : 0 }}>
              Current version: <strong>v{currentVersion}</strong>
              {requiredVersion ? (
                <>
                  {" "}
                  | Required: <strong>v{requiredVersion}</strong>
                </>
              ) : null}
            </Typography>
            {adminPopupReleaseNotes ? (
              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  What&apos;s new
                </Typography>
                <Typography
                  variant="body2"
                  component="div"
                  sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}
                >
                  {adminPopupReleaseNotes}
                </Typography>
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 2, pb: 2 }}>
            <Button
              color="inherit"
              disabled={adminPopupBusy}
              onClick={() => {
                void dismissAdminUpdateNotice();
              }}
            >
              Dismiss
            </Button>
            <Button
              variant="contained"
              disabled={adminPopupBusy}
              onClick={() => {
                void openAdminUpdateDownload();
              }}
            >
              Download update
            </Button>
            <Button
              variant="outlined"
              disabled={adminPopupBusy}
              onClick={() => {
                void handleAdminCheckForUpdate();
              }}
            >
              {adminPopupBusy ? "Opening…" : "Check for update"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {/* Dev-only overlay: off by default. Set VITE_SHOW_DEV_STATE=true in .env.local to enable. */}
      {import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_STATE === 'true' && (
        <Box
          sx={{
            position: 'fixed',
            right: 12,
            bottom: 12,
            zIndex: 9999,
            backgroundColor: 'rgba(255,255,255,0.95)',
            border: '1px solid #666',
            borderRadius: 1,
            boxShadow: 3,
            p: 1,
            maxWidth: 360,
            fontSize: 12,
            color: '#000',
          }}
        >
          <div><strong>Dev state:</strong></div>
          <div>auth={String(isAuthenticated)}</div>
          <div>loading={String(loading)}</div>
          <div>license={String(licenseValid)}</div>
          <div>licenseDone={String(licenseCheckDone)}</div>
          <div>profile={String(profileCompleted)}</div>
          <div>setup={String(setupCompleted)}</div>
          <div>hostOk={String(hostCheck.ok)}</div>
          <div>path={window.location.pathname}{window.location.hash}</div>
        </Box>
      )}
      <Box
        sx={{
          height: '100%',
          width: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
      {isAuthenticated &&
        profileCompleted &&
        setupCompleted &&
        licenseValid &&
        licenseCheckDone &&
        !hostCheck.ok && (
          <ConnectToHost
            initialServerUrl={networkService.getStatus().serverUrl}
            initialError={hostCheck.error}
            initialChecking={hostCheck.checking}
            onConnected={() => {
              setHostCheck((s) => ({ ...s, ok: true, checking: false, error: undefined }));
            }}
            onExitSingleUser={() => {
              exitMultiUserClientMode();
              navigateInApp("/dashboard");
            }}
            onOpenLanPaymentSettings={() => {
              exitMultiUserClientMode();
              navigateInApp("/settings", "tab=multiuser");
            }}
          />
        )}
      <FocusProvider>
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Router>
          {/* Setup Wizard */}
          <SetupWizard
            open={showSetupWizard && isAuthenticated}
            onComplete={handleSetupComplete}
            onRestoreBackup={handleRestoreBackup}
          />

          <Routes>
          {/* LOGIN */}
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                companyGate === 'select' ? (
                  <Navigate to="/select-company" replace />
                ) : (
                  <Navigate to={(profileCompleted ? "/dashboard" : "/business-profile")} replace />
                )
              ) : (
                <Login />
              )
            }
          />

          <Route
            path="/select-company"
            element={
              !isAuthenticated ? (
                <Navigate to="/login" replace />
              ) : !licenseValid || !licenseCheckDone ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                  <CircularProgress />
                </Box>
              ) : companyGate === 'ready' ? (
                <Navigate to={(profileCompleted ? "/dashboard" : "/business-profile")} replace />
              ) : companyGate === 'loading' ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                  <CircularProgress />
                </Box>
              ) : (
                <CompanySelectScreen mode="startup" />
              )
            }
          />

          <Route
            path="/activate"
            element={
              /* Only skip Activate after license is valid; otherwise logged-in users without a cache/license
               * were bounced to /dashboard, no route matched (license gate), * sent them back → infinite loop. */
              isAuthenticated && licenseValid && licenseCheckDone ? (
                <Navigate to={(profileCompleted ? "/dashboard" : "/business-profile")} replace />
              ) : (
                <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
                  <Activate />
                </Suspense>
              )
            }
          />

          <Route
            path="/business-profile"
            element={
              isAuthenticated ? (
                profileCompleted ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <BusinessProfile />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* DEFAULT ROUTE – handle initial app load */}
          <Route 
            path="/" 
            element={
              isAuthenticated ? (
                licenseValid ? (
                  companyGate === 'select' ? (
                    <Navigate to="/select-company" replace />
                  ) : companyGate === 'loading' ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                      <CircularProgress />
                    </Box>
                  ) : profileCompleted ? (
                    setupCompleted ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <Navigate to="/business-profile" replace />
                    )
                  ) : (
                    <Navigate to="/business-profile" replace />
                  )
                ) : (
                  <Navigate to="/activate" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          {/* FALLBACK ROUTE – redirect to login or activate based on auth state */}
          <Route 
            path="*" 
            element={
              isAuthenticated ? (
                licenseValid ? (
                  profileCompleted ? (
                    setupCompleted ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <Navigate to="/business-profile" replace />
                    )
                  ) : (
                    <Navigate to="/business-profile" replace />
                  )
                ) : (
                  <Navigate to="/activate" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          {/* PROTECTED ROUTES – only when logged in, business profile completed, setup complete, AND LICENSE VALID */}
          {isAuthenticated && profileCompleted && setupCompleted && licenseValid && licenseCheckDone && companyGate === 'ready' && (
            <>
              {hostCheck.ok ? (
                <>
                  <Route path="/print" element={<PrintWindow />} />
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="items" element={<ItemsModuleShell />}>
                      <Route index element={<ItemsWorkspace />} />
                      <Route
                        path="price-lists"
                        element={
                          <RequirePermission permission="view-inventory">
                            <PriceListList />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="adjustments/new"
                        element={
                          <RequirePermission permission="manage-inventory">
                            <StockAdjustmentForm />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="adjustments"
                        element={
                          <RequirePermission permission="view-inventory">
                            <StockAdjustmentList />
                          </RequirePermission>
                        }
                      />
                    </Route>
                    <Route path="banking" element={<BankingHub />} />
                    <Route path="sales" element={<SalesManagementShell />}>
                      <Route index element={<Navigate to="/sales/tax-invoices" replace />} />
                      <Route
                        path="invoices/:id"
                        element={
                          <RequirePermission permission="create-vouchers">
                            <SalesVoucherForm />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="collections/new"
                        element={
                          <RequirePermission permission="create-vouchers">
                            <CollectionFormPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="collections/:id/edit"
                        element={
                          <RequirePermission permission="create-vouchers">
                            <CollectionFormPage />
                          </RequirePermission>
                        }
                      />
                      <Route path=":docKind/new" element={<SalesPipelineForm />} />
                      <Route path=":docKind/:id/edit" element={<SalesPipelineForm />} />
                      <Route path=":docKind" element={<SalesDocumentPage />} />
                    </Route>
                    <Route path="purchase" element={<PurchaseManagementShell />}>
                      <Route index element={<Navigate to="/purchase/purchase-bills" replace />} />
                      <Route path=":docKind" element={<PurchaseDocumentPage />} />
                    </Route>
                    <Route path="products" element={<Navigate to="/items" replace />} />
                    <Route path="products/new" element={<Navigate to="/masters/inventory-items/new" replace />} />
                    <Route path="products/edit/:id" element={<Navigate to="/masters/inventory-items" replace />} />
                    <Route path="customers" element={<CustomersModuleShell />}>
                      <Route index element={<CustomersListPage />} />
                      <Route path="ledger-report" element={<PartyLedgerReport />} />
                      <Route path=":id" element={<CustomerDetailPage />} />
                    </Route>
                    <Route path="parties" element={<Navigate to="/customers" replace />} />
                    <Route path="parties/new" element={<Navigate to="/customers?new=1" replace />} />
                    <Route path="parties/:id" element={<PartyForm />} />
                    <Route path="parties/ledger-report" element={<PartyLedgerReport />} />
                    <Route path="parties/party-ledger/:ledgerId" element={<LedgerStatementByLedgerId />} />
                    <Route path="invoices" element={<Navigate to="/vouchers/sales" replace />} />
                    <Route path="vouchers" element={<VouchersHub />} />
                    <Route path="vouchers/money" element={<MoneyVouchersHub />} />
                    <Route path="vouchers/payment" element={<Navigate to="/vouchers/payment-vouchers" replace />} />
                    <Route path="vouchers/payment/new" element={<Navigate to="/vouchers/payment-vouchers/new" replace />} />
                    <Route path="vouchers/receipt" element={<Navigate to="/vouchers/receipt-vouchers" replace />} />
                    <Route path="vouchers/receipt/new" element={<Navigate to="/vouchers/receipt-vouchers/new" replace />} />
                    <Route path="purchase-invoices" element={<PurchaseInvoices />} />
                    <Route path="debit-notes" element={<DebitNotes />} />
                    <Route path="/payments/*" element={<Payments />} />
                    <Route path="accounts" element={<BankLedgerList />} />
                    <Route path="masters/bank-accounts" element={<BankLedgerList />} />
                    <Route path="accounts/*" element={<BankLedgerList />} />
                    <Route path="expenses/*" element={<ManualExpenseEntry />} />
                    <Route path="schemes" element={<Schemes />} />
                    <Route path="schemes/new" element={<SmartSchemeForm />} />
                    <Route path="schemes/retailer-dashboard" element={<RetailerSchemeDashboard />} />
                    <Route path="schemes/overdue-tracker" element={<OverdueTracker />} />
                    <Route
                      path="vouchers/sales-return"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <SalesReturnVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/sales-return/new"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <SalesReturnVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/ledger-accounts"
                      element={
                        <RequirePermission permission="view-ledgers">
                          <LedgerAccountList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/ledger-accounts/new"
                      element={
                        <RequirePermission permission="manage-ledgers">
                          <LedgerAccountForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/ledger-accounts/:id/edit"
                      element={
                        <RequirePermission permission="manage-ledgers">
                          <LedgerAccountForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/godowns"
                      element={
                        <RequirePermission permission="view-inventory">
                          <GodownList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/godowns/new"
                      element={
                        <RequirePermission permission="manage-inventory">
                          <GodownForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/godowns/:id/edit"
                      element={
                        <RequirePermission permission="manage-inventory">
                          <GodownForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/inventory-items"
                      element={<Navigate to="/items" replace />}
                    />
                    <Route
                      path="masters/inventory-items/new"
                      element={
                        <RequirePermission permission="manage-inventory">
                          <InventoryItemForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/inventory-items/:id/edit"
                      element={
                        <RequirePermission permission="manage-inventory">
                          <InventoryItemForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/inventory-items/:id"
                      element={<Navigate to="/items" replace />}
                    />
                    <Route
                      path="masters/price-lists"
                      element={
                        <RequirePermission permission="view-inventory">
                          <PriceListList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/price-lists/new"
                      element={
                        <RequirePermission permission="manage-inventory">
                          <PriceListForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/price-lists/:id/edit"
                      element={
                        <RequirePermission permission="manage-inventory">
                          <PriceListForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/stock-adjustments"
                      element={
                        <RequirePermission permission="view-inventory">
                          <StockAdjustmentList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/stock-adjustments/new"
                      element={
                        <RequirePermission permission="manage-inventory">
                          <StockAdjustmentForm />
                        </RequirePermission>
                      }
                    />
                    <Route path="import/erp" element={<ImportFromErp />} />
                    <Route
                      path="approvals/pending"
                      element={
                        <RequirePermission permission="manage-users">
                          <ApprovalPendingPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/sales"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <SalesVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/sales/new"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <SalesVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/sales/:id/edit"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <SalesVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/sales/new-staged"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <Navigate to="/vouchers/sales/new" replace />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/purchase"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <PurchaseVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/purchase/new"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <PurchaseVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/purchase/:id/edit"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <PurchaseVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/purchase-return"
                      element={
                        <RequirePermission permission="view-vouchers">
                          <PurchaseReturnVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/purchase-return/new"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <PurchaseReturnVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/payment-vouchers"
                      element={
                        <RequirePermission permission="view-vouchers">
                          <PaymentVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/money/new"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
                            <PaymentVoucherPage includeExpenseLedgersInParticulars fullScreenMode />
                          </Suspense>
                        </RequirePermission>
                      }
                    />
                    <Route path="vouchers/payment-vouchers/new" element={<Navigate to="/vouchers/money/new?type=PAYMENT" replace />} />
                    <Route path="vouchers/receipt-vouchers/new" element={<Navigate to="/vouchers/money/new?type=RECEIPT" replace />} />
                    <Route
                      path="vouchers/payment-vouchers/:id/edit"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
                            <PaymentVoucherPage includeExpenseLedgersInParticulars initialType="PAYMENT" forceModernView />
                          </Suspense>
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/receipt-vouchers"
                      element={
                        <RequirePermission permission="view-vouchers">
                          <ReceiptVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/receipt-vouchers/:id/edit"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
                            <PaymentVoucherPage includeExpenseLedgersInParticulars initialType="RECEIPT" forceModernView />
                          </Suspense>
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/journal"
                      element={
                        <RequirePermission permission="view-vouchers">
                          <JournalVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/journal/new"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <JournalVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route path="reports" element={<Reports />} />
                    <Route path="reports/outstanding-aging" element={<OutstandingAgingReport />} />
                    <Route path="reports/low-stock" element={<LowStockReport />} />
                    <Route path="gst" element={<GSTReports />} />
                    <Route path="gst/gstr1" element={<GSTR1Report />} />
                    <Route path="gst/gstr2" element={<GSTR2Report />} />
                    <Route path="gst/gstr3b" element={<GSTR3BReport />} />
                    <Route path="gst/gstr9" element={<GSTR9Report />} />
                    <Route path="gst/hsn-summary" element={<HSNSummary />} />
                    <Route path="user-management" element={<Navigate to="/settings" replace />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </>
              ) : (
                <Route
                  path="*"
                  element={
                    <ConnectToHost
                      initialServerUrl={networkService.getStatus().serverUrl}
                      initialError={hostCheck.error}
                      initialChecking={hostCheck.checking}
                      onConnected={() => {
                        setHostCheck((s) => ({ ...s, ok: true, checking: false, error: undefined }));
                      }}
                      onExitSingleUser={() => {
                        exitMultiUserClientMode();
                        navigateInApp("/dashboard");
                      }}
                      onOpenLanPaymentSettings={() => {
                        exitMultiUserClientMode();
                        navigateInApp("/settings", "tab=multiuser");
                      }}
                    />
                  }
                />
              )}
            </>
          )}

          {/* LICENSE VALIDATION REQUIRED */}
          {isAuthenticated && licenseCheckDone && !licenseValid && (
            <Route
              path="*"
              element={
                <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
                  <Activate />
                </Suspense>
              }
            />
          )}

          {/* FALLBACK */}
          <Route
            path="*"
            element={
              isAuthenticated ? (
                licenseCheckDone && !licenseValid ? (
                  <Navigate to="/activate" replace />
                ) : (
                  <Navigate to={(profileCompleted ? "/dashboard" : "/business-profile")} replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          </Routes>
        </Router>
        </Box>
      </FocusProvider>
      </Box>
    </>
  );
}

export default App;
