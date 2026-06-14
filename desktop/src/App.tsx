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
import MobileEntitlementBootstrap from "./components/MobileEntitlementBootstrap";
import MiddlewareSyncBootstrap from "./components/MiddlewareSyncBootstrap";
import RequirePermission from "./components/RequirePermission";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ConnectToHost from "./pages/ConnectToHost";
import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from "react";
import { RedirectInventoryItemEdit } from "./pages/Masters/InventoryItems/InventoryItemEditRedirect";
import BusinessProfile from "./pages/BusinessProfile";
import { ItemsModuleShell } from "./components/items/ItemsModuleShell";
import { LedgersModuleShell } from "./components/ledgers/LedgersModuleShell";
import { SalesManagementShell } from "./components/sales/SalesManagementShell";
import { PurchaseManagementShell } from "./components/purchase/PurchaseManagementShell";
import { prefetchAllAppRoutes } from "./app/prefetchRoutes";
import {
  BankingHub,
  CustomersListPage,
  GSTReports,
  ItemsWorkspace,
  PurchaseDocumentPage,
  Reports,
  DayBookPage,
  SalesDocumentPage,
  Schemes,
  Settings,
} from "./app/modulePages";
import {
  LazyAllLedgersPage,
  LazyCreditorsListPage,
  LazyApprovalPendingPage,
  LazyBankLedgerList,
  LazyCollectionFormPage,
  LazyCustomerDetailPage,
  LazyCustomerLedgerStatementPage,
  LazyDashboardKpiDrillPage,
  LazyDebitNotes,
  LazyEWayBillPage,
  LazyGodownForm,
  LazyGodownList,
  LazyGSTR1Report,
  LazyGSTR2Report,
  LazyGSTR3BReport,
  LazyGSTR9Report,
  LazyHSNSummary,
  LazyImportFromErp,
  LazyInventoryItemDetail,
  LazyInventoryItemList,
  LazyJournalVoucherForm,
  LazyJournalVoucherList,
  LazyLedgerAccountForm,
  LazyLedgerAccountList,
  LazyChartOfAccountsPage,
  LazyAccountingStructureAuditPage,
  LazyAccountingIntegrityAuditPage,
  LazyFinancialStatementReadinessAuditPage,
  LazyActivate,
  LazyLedgerStatementByLedgerId,
  LazyLowStockReport,
  LazyManualExpenseEntry,
  LazyMoneyVouchersHub,
  LazyOutstandingAgingReport,
  LazyPartyOutstandingReport,
  LazyOverdueTracker,
  LazyPartyForm,
  LazyPartyLedgerReport,
  LazyPaymentVoucherList,
  LazyPaymentVoucherPage,
  LazyPayments,
  LazyPriceListForm,
  LazyPriceListList,
  LazyPrintWindow,
  LazyPurchaseInvoices,
  LazyPurchasePipelineForm,
  LazyPurchaseReturnVoucherForm,
  LazyPurchaseReturnVoucherList,
  LazyPurchaseVoucherForm,
  LazyPurchaseVoucherList,
  LazyReceiptVoucherList,
  LazyRetailerSchemeDashboard,
  LazySalesPipelineForm,
  LazySalesReturnVoucherForm,
  LazySalesReturnVoucherList,
  LazySalesVoucherForm,
  LazySalesVoucherList,
  LazySmartSchemeForm,
  LazyStockAdjustmentForm,
  LazyStockAdjustmentList,
  LazyStorePage,
  LazyVouchersHub,
} from "./app/lazyPages";

import { useAuth } from "./pages/contexts/auth";
import FocusProvider from "./contexts/FocusProvider";
import SetupWizard from "./components/SetupWizard";
import { invoke } from "@tauri-apps/api/core";
import { networkService } from "./services/networkService";
import { detectDeviceChange, forceLogoutDueToDeviceChange, subscribeToLicenseDeactivationWithVisibility } from "./services/deviceChangeDetector";
import {
  getOptimisticStartupLicense,
  persistLicenseValidationResult,
} from "./services/loginService";
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
  listCompaniesEnriched,
  switchCompany,
} from "./services/companyRegistryService";
import CompanySelectScreen from "./components/CompanySelectScreen";
import { withTimeout } from "./utils/withTimeout";
import {
  evaluateOnboardingDecision,
  logProfileDebugEvent,
  runStartupProfileDiagnostics,
} from "./services/businessProfileDebugService";
import {
  getProfileCompletionStatus,
  preloadCompanyProfile,
  runProfileMigration,
} from "./services/companyProfileDbService";
import {
  isLocalBusinessProfileComplete,
  markLocalBusinessProfileComplete,
} from "./services/businessProfileService";
import DataLocationFirstRunDialog, {
  needsDataLocationFirstRun,
} from "./components/DataLocationFirstRunDialog";
import SuperAdminPanel from "./components/superadmin/SuperAdminPanel";
import { shouldOpenSuperAdminPanel } from "./services/superAdminService";
import TrialLoginScreen from "./screens/trial/TrialLoginScreen";
import LocalTrialExpiredModal from "./components/LocalTrialExpiredModal";
import {
  isLocalTrialActive,
  isLocalTrialExpired,
  isTrialAccountEmail,
} from "./services/localTrialService";

function App() {
  console.log("📱 App (AuthContext version) rendering...");

  const { isAuthenticated, loading, user, logout } = useAuth();

  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [profileGate, setProfileGate] = useState<'loading' | 'complete' | 'incomplete'>('loading');
  const [deviceCheckDone, setDeviceCheckDone] = useState(false);
  const [licenseCheckDone, setLicenseCheckDone] = useState(false);
  const [licenseValid, setLicenseValid] = useState(false);
  const [licenseCheckReason, setLicenseCheckReason] = useState<string>('');
  const [companyGate, setCompanyGate] = useState<'loading' | 'select' | 'ready'>('loading');
  const [superAdminOpen, setSuperAdminOpen] = useState(() => shouldOpenSuperAdminPanel());
  const [localTrialExpired, setLocalTrialExpired] = useState<boolean | null>(null);
  const profileCompleted = profileGate === 'complete';
  const setupCompleted = profileGate === 'complete';

  useEffect(() => {
    const onCompanyReady = () => setCompanyGate('ready');
    window.addEventListener('companyGateReady', onCompanyReady);
    return () => window.removeEventListener('companyGateReady', onCompanyReady);
  }, []);

  useEffect(() => {
    if (isAuthenticated && shouldOpenSuperAdminPanel()) {
      setSuperAdminOpen(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (shouldOpenSuperAdminPanel()) {
      setLocalTrialExpired(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const expired = await isLocalTrialExpired();
      if (!cancelled) setLocalTrialExpired(expired);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.email]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    evaluateOnboardingDecision(profileGate === 'complete');
  }, [isAuthenticated, loading, user?.email, profileGate]);
  const [hostCheck, setHostCheck] = useState<{ checking: boolean; ok: boolean; serverUrl?: string; error?: string }>({
    checking: false,
    ok: true,
  });
  const [adminUpdateNotice, setAdminUpdateNotice] = useState<any | null>(null);
  const [adminPopupBusy, setAdminPopupBusy] = useState(false);
  const [adminPopupReleaseNotes, setAdminPopupReleaseNotes] = useState('');
  const licenseCheckGeneration = useRef(0);
  const startupGatesRanRef = useRef(false);
  const [dataLocationSetupOpen, setDataLocationSetupOpen] = useState(false);

  const shellReady =
    isAuthenticated &&
    profileCompleted &&
    setupCompleted &&
    licenseValid &&
    licenseCheckDone &&
    companyGate === 'ready';

  const startupGateSpinner = (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <CircularProgress />
    </Box>
  );

  const pageSuspense = (
    <Box sx={{ px: 2, pt: 1 }}>
      <CircularProgress size={22} />
    </Box>
  );

  const startupGatesBusy =
    isAuthenticated &&
    isElectronRuntime() &&
    (profileGate === 'loading' || companyGate === 'loading');

  // Warm all lazy route chunks after shell is ready so every sidebar tab opens quickly.
  useEffect(() => {
    if (!shellReady) return;
    const timer = window.setTimeout(() => prefetchAllAppRoutes(), 300);
    return () => window.clearTimeout(timer);
  }, [shellReady]);

  useEffect(() => {
    if (!isElectronRuntime()) return;
    void needsDataLocationFirstRun().then((need) => {
      if (need) setDataLocationSetupOpen(true);
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      startupGatesRanRef.current = false;
      setLicenseCheckDone(false);
      setLicenseValid(false);
      setLicenseCheckReason('');
      setProfileGate('loading');
      setCompanyGate('loading');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!isElectronRuntime()) {
      setProfileGate(Boolean((user as any)?.completedBusinessProfile) ? 'complete' : 'incomplete');
      setCompanyGate('ready');
      startupGatesRanRef.current = true;
      return;
    }
    if (!licenseCheckDone || !licenseValid) return;
    if (startupGatesRanRef.current) return;

    let cancelled = false;
    void (async () => {
      try {
        const [companyResult, profileCompleted] = await Promise.all([
          (async (): Promise<'loading' | 'select' | 'ready'> => {
            await ensureCompaniesInitialized();
            const res = await listCompaniesEnriched();
            const def = res.defaultCompany;
            const target = def ? res.companies.find((c) => c.id === def) : undefined;
            if (def && target?.folderOk) {
              if (res.activeId !== def) {
                const active = await switchCompany(def);
                await applyCompanySwitch(active);
              }
              return 'ready';
            }
            return 'select';
          })(),
          (async (): Promise<boolean> => {
            if (isLocalBusinessProfileComplete()) {
              await preloadCompanyProfile();
              return true;
            }
            const [, status] = await Promise.all([
              runProfileMigration(),
              getProfileCompletionStatus(),
            ]);
            await preloadCompanyProfile();
            const complete = Boolean(status.profileCompleted ?? status.PROFILE_COMPLETED);
            if (complete) markLocalBusinessProfileComplete();
            return complete;
          })(),
        ]);

        if (cancelled) return;
        startupGatesRanRef.current = true;
        setCompanyGate(companyResult);
        setProfileGate(profileCompleted ? 'complete' : 'incomplete');
        setShowSetupWizard(false);
        evaluateOnboardingDecision(profileCompleted);
        void logProfileDebugEvent('onboarding_gate_db', { companyResult, profileCompleted });
        setTimeout(() => void runStartupProfileDiagnostics(user?.email), 2500);
      } catch (e) {
        console.warn('[startup] gates failed', e);
        if (!cancelled) {
          startupGatesRanRef.current = true;
          setCompanyGate('select');
          setProfileGate('incomplete');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.email, licenseCheckDone, licenseValid]);

  useEffect(() => {
    const syncProfileFlag = async () => {
      if (!isElectronRuntime()) return;
      if (isLocalBusinessProfileComplete()) {
        await preloadCompanyProfile();
        setProfileGate('complete');
        return;
      }
      const status = await getProfileCompletionStatus();
      await preloadCompanyProfile();
      const complete = Boolean(status.profileCompleted ?? status.PROFILE_COMPLETED);
      if (complete) markLocalBusinessProfileComplete();
      setProfileGate((prev) => {
        if (complete || prev === 'complete') return 'complete';
        return 'incomplete';
      });
    };
    window.addEventListener('companyProfileUpdated', syncProfileFlag as EventListener);
    return () => {
      window.removeEventListener('companyProfileUpdated', syncProfileFlag as EventListener);
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

  // Admin update notice — deferred so Firebase never blocks first paint
  useEffect(() => {
    if (!db) return;
    const email = String((user as any)?.email ?? "").trim().toLowerCase();
    if (!isAuthenticated || !email) {
      setAdminUpdateNotice(null);
        return;
      }

    let unsub: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      unsub = onSnapshot(
        doc(db, "users", email),
        (snap) => {
          const d = snap.exists() ? (snap.data() as any) : null;
          const notice = d?.adminUpdateNotice ?? null;
          setAdminUpdateNotice(notice || null);
        },
        () => {
          // ignore — offline
        }
      );
    }, 5000);

    return () => {
      window.clearTimeout(timer);
      unsub?.();
    };
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

  // Licence: instant local cache gate, full validation in background (never blocks window)
  useEffect(() => {
    let cancelled = false;
    const gen = ++licenseCheckGeneration.current;

    const applyLicenseResult = async (
      result: {
        isValid: boolean;
        needsActivation?: boolean;
        reason?: string;
        multiUserLan?: boolean;
      },
      fromBackground: boolean
    ) => {
      persistLicenseValidationResult(result);
        if (result.isValid) {
          setLicenseValid(true);
          setLicenseCheckReason('');
        setDeviceCheckDone(true);
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
        if (fromBackground) {
          setTimeout(() => void syncHostMultiUserLanFromCloud(Boolean(result.multiUserLan)), 5000);
          setTimeout(
            () =>
              void import('./services/userActivityService').then(({ startUsageTracking }) =>
                startUsageTracking()
              ),
            5000
          );
        }
        return;
      }

          setLicenseValid(false);
          setLicenseCheckReason(result.reason || 'License validation failed');
      try {
        localStorage.setItem('license_multi_user_lan', '0');
      } catch {
        // ignore
      }
      if (fromBackground) void syncHostMultiUserLanFromCloud(false);

          if (result.needsActivation) {
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
      }
    };

    void (async () => {
      if (!isAuthenticated || licenseCheckDone) return;

      if (shouldOpenSuperAdminPanel()) {
        setLicenseValid(true);
        setLicenseCheckReason('');
        setDeviceCheckDone(true);
        setLicenseCheckDone(true);
            return;
          }

      const localTrialOk = await isLocalTrialActive();
      if (localTrialOk && isTrialAccountEmail(user?.email)) {
        setLicenseValid(true);
        setLicenseCheckReason('');
        setDeviceCheckDone(true);
        setLicenseCheckDone(true);
        return;
      }

      const optimistic = await getOptimisticStartupLicense();
      if (cancelled || gen !== licenseCheckGeneration.current) return;

      if (optimistic.isValid) {
        await applyLicenseResult(optimistic, false);
        setLicenseCheckDone(true);
      } else {
        await applyLicenseResult(optimistic, false);
          setLicenseCheckDone(true);
        }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, licenseCheckDone, logout, user?.email]);

  // Device change detection — runs after license check (license already validates device when valid)
  useEffect(() => {
    let cancelled = false;

    const checkDeviceChange = async () => {
      if (!isAuthenticated || deviceCheckDone || !licenseCheckDone) return;
      if (licenseValid) {
        setDeviceCheckDone(true);
        return;
      }

      try {
        const result = await withTimeout(detectDeviceChange(), 8000, { changed: false });
        
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
  }, [isAuthenticated, deviceCheckDone, licenseCheckDone, licenseValid, logout]);

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

    const unsubscribe = subscribeToLicenseDeactivationWithVisibility({
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
  const handleSetupComplete = (_companyData: unknown) => {
    setShowSetupWizard(false);
    setProfileGate('complete');
    window.dispatchEvent(new Event('companyProfileUpdated'));
  };

  const handleRestoreBackup = (_backupPath: string) => {
    setShowSetupWizard(false);
    setProfileGate('complete');
    window.dispatchEvent(new Event('companyProfileUpdated'));
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%',
          flexDirection: 'column',
          gap: 2,
        }}
      >
          <CircularProgress size={60} />
          <Typography variant="h6">Loading {APP_DISPLAY_NAME}...</Typography>
          <Typography variant="body2" color="text.secondary">
          Checking authentication...
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

  if (localTrialExpired === true) {
    return <LocalTrialExpiredModal />;
  }

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
          <div>profileGate={profileGate}</div>
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
      <DataLocationFirstRunDialog
        open={dataLocationSetupOpen}
        onComplete={() => setDataLocationSetupOpen(false)}
      />
      {startupGatesBusy && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 12000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 1.5,
            bgcolor: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <CircularProgress size={48} />
          <Typography variant="body1" fontWeight={600}>
            Loading {APP_DISPLAY_NAME}...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {companyGate === 'loading' ? 'Loading company data...' : 'Preparing your workspace...'}
          </Typography>
        </Box>
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
          {isAuthenticated &&
            profileCompleted &&
            setupCompleted &&
            licenseValid &&
            licenseCheckDone &&
            companyGate === 'ready' &&
            hostCheck.ok && <MobileEntitlementBootstrap />}
          {isAuthenticated && <MiddlewareSyncBootstrap />}

          <Suspense fallback={pageSuspense}>
          <Routes>
          {/* LOGIN */}
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                companyGate === 'loading' ? (
                  startupGateSpinner
                ) : companyGate === 'select' ? (
                  <Navigate to="/select-company" replace />
                ) : profileCompleted && shellReady ? (
                  <Navigate to="/dashboard" replace />
                ) : profileCompleted ? (
                  startupGateSpinner
                ) : (
                  <Navigate to="/business-profile" replace />
                )
              ) : (
                <Login />
              )
            }
          />

          <Route
            path="/trial"
            element={
              isAuthenticated ? (
                <Navigate to="/select-company" replace />
              ) : (
                <TrialLoginScreen />
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
                profileCompleted && shellReady ? (
                  <Navigate to="/dashboard" replace />
                ) : profileCompleted ? (
                  startupGateSpinner
                ) : (
                  <Navigate to="/business-profile" replace />
                )
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
                companyGate === 'loading' ? (
                  startupGateSpinner
                ) : companyGate === 'select' ? (
                  <Navigate to="/select-company" replace />
                ) : profileCompleted && shellReady ? (
                      <Navigate to="/dashboard" replace />
                ) : profileCompleted ? (
                  startupGateSpinner
                    ) : (
                      <Navigate to="/business-profile" replace />
                    )
                  ) : (
                <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
                  <LazyActivate />
                </Suspense>
              )
            }
          />

          <Route
            path="/business-profile"
            element={
              isAuthenticated ? (
                profileCompleted ? (
                  companyGate === 'loading' ? (
                    startupGateSpinner
                  ) : companyGate === 'select' ? (
                    <Navigate to="/select-company" replace />
                  ) : shellReady ? (
                    <Navigate to="/dashboard" replace />
                  ) : (
                    startupGateSpinner
                  )
                ) : (
                  <BusinessProfile />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          {/* Root redirect only while company shell is not ready (Layout owns "/" when ready). */}
          {companyGate !== 'ready' && (
          <Route 
              path="/"
            element={
              isAuthenticated ? (
                licenseValid ? (
                    companyGate === 'select' ? (
                      <Navigate to="/select-company" replace />
                    ) : companyGate === 'loading' ? (
                      startupGateSpinner
                    ) : profileCompleted ? (
                      <Navigate to="/business-profile" replace />
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
          )}

          {/* PROTECTED ROUTES – only when logged in, business profile completed, setup complete, AND LICENSE VALID */}
          {isAuthenticated && profileCompleted && setupCompleted && licenseValid && licenseCheckDone && companyGate === 'ready' && (
            <>
              {hostCheck.ok ? (
                <>
                  <Route path="/print" element={<LazyPrintWindow />} />
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="items" element={<ItemsModuleShell />}>
                      <Route index element={<ItemsWorkspace />} />
                      <Route
                        path="price-lists"
                        element={
                          <RequirePermission permission="view-inventory">
                            <LazyPriceListList />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="adjustments/new"
                        element={
                          <RequirePermission permission="manage-inventory">
                            <LazyStockAdjustmentForm />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="adjustments"
                        element={
                          <RequirePermission permission="view-inventory">
                            <LazyStockAdjustmentList />
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
                            <LazySalesVoucherForm />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="collections/new"
                        element={
                          <RequirePermission permission="create-vouchers">
                            <LazyCollectionFormPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="collections/:id/edit"
                        element={
                          <RequirePermission permission="create-vouchers">
                            <LazyCollectionFormPage />
                          </RequirePermission>
                        }
                      />
                      <Route path=":docKind/new" element={<LazySalesPipelineForm />} />
                      <Route path=":docKind/:id/edit" element={<LazySalesPipelineForm />} />
                      <Route path=":docKind" element={<SalesDocumentPage />} />
                    </Route>
                    <Route path="purchase" element={<PurchaseManagementShell />}>
                      <Route index element={<Navigate to="/purchase/purchase-bills" replace />} />
                      <Route path=":docKind/new" element={<LazyPurchasePipelineForm />} />
                      <Route path=":docKind/:id/edit" element={<LazyPurchasePipelineForm />} />
                      <Route path=":docKind" element={<PurchaseDocumentPage />} />
                    </Route>
                    <Route path="products" element={<Navigate to="/items" replace />} />
                    <Route path="products/new" element={<Navigate to="/items?new=1" replace />} />
                    <Route path="products/edit/:id" element={<Navigate to="/items" replace />} />
                    <Route path="ledgers" element={<LedgersModuleShell />}>
                      <Route index element={<LazyAllLedgersPage />} />
                      <Route path="debtors" element={<CustomersListPage />} />
                      <Route path="debtors/:id/statement" element={<LazyCustomerLedgerStatementPage />} />
                      <Route path="debtors/:id" element={<LazyCustomerDetailPage />} />
                      <Route path="creditors" element={<LazyCreditorsListPage />} />
                      <Route path="report" element={<LazyPartyLedgerReport />} />
                    </Route>
                    <Route path="customers" element={<Navigate to="/ledgers/debtors" replace />} />
                    <Route path="customers/ledger-report" element={<Navigate to="/ledgers/report" replace />} />
                    <Route path="customers/:id/statement" element={<LazyCustomerLedgerStatementPage />} />
                    <Route path="customers/:id" element={<LazyCustomerDetailPage />} />
                    <Route path="parties" element={<Navigate to="/ledgers/debtors" replace />} />
                    <Route path="parties/new" element={<Navigate to="/ledgers/debtors?new=1" replace />} />
                    <Route path="parties/ledger-report" element={<Navigate to="/ledgers/report" replace />} />
                    <Route path="parties/:id" element={<LazyPartyForm />} />
                    <Route path="parties/party-ledger/:ledgerId" element={<LazyLedgerStatementByLedgerId />} />
                    <Route path="suppliers" element={<Navigate to="/purchase/purchase-bills" replace />} />
                    <Route path="banks" element={<Navigate to="/masters/bank-accounts" replace />} />
                    <Route path="banks/new" element={<Navigate to="/masters/ledger-accounts/new" replace />} />
                    <Route path="banks/edit/:id" element={<Navigate to="/masters/ledger-accounts/:id/edit" replace />} />
                    <Route path="banks/:id/statement" element={<Navigate to="/masters/bank-accounts" replace />} />
                    <Route path="invoices" element={<Navigate to="/vouchers/sales" replace />} />
                    <Route path="vouchers" element={<LazyVouchersHub />} />
                    <Route path="vouchers/money" element={<LazyMoneyVouchersHub />} />
                    <Route path="vouchers/payment" element={<Navigate to="/vouchers/payment-vouchers" replace />} />
                    <Route path="vouchers/payment/new" element={<Navigate to="/vouchers/payment-vouchers/new" replace />} />
                    <Route path="vouchers/receipt" element={<Navigate to="/vouchers/receipt-vouchers" replace />} />
                    <Route path="vouchers/receipt/new" element={<Navigate to="/vouchers/receipt-vouchers/new" replace />} />
                    <Route path="purchase-invoices" element={<LazyPurchaseInvoices />} />
                    <Route path="debit-notes" element={<LazyDebitNotes />} />
                    <Route path="/payments/*" element={<LazyPayments />} />
                    <Route path="accounts" element={<LazyBankLedgerList />} />
                    <Route path="masters/bank-accounts" element={<LazyBankLedgerList />} />
                    <Route path="accounts/*" element={<LazyBankLedgerList />} />
                    <Route path="expenses/*" element={<LazyManualExpenseEntry />} />
                    <Route path="schemes" element={<Schemes />} />
                    <Route path="schemes/new" element={<LazySmartSchemeForm />} />
                    <Route path="schemes/retailer-dashboard" element={<LazyRetailerSchemeDashboard />} />
                    <Route path="schemes/overdue-tracker" element={<LazyOverdueTracker />} />
                    <Route
                      path="vouchers/sales-return"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <LazySalesReturnVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/sales-return/new"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <LazySalesReturnVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/ledger-accounts"
                      element={
                        <RequirePermission permission="view-ledgers">
                          <LazyLedgerAccountList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/ledger-accounts/new"
                      element={
                        <RequirePermission permission="manage-ledgers">
                          <LazyLedgerAccountForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/ledger-accounts/:id/edit"
                      element={
                        <RequirePermission permission="manage-ledgers">
                          <LazyLedgerAccountForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/chart-of-accounts"
                      element={
                        <RequirePermission permission="view-ledgers">
                          <LazyChartOfAccountsPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/ledger-audit"
                      element={
                        <RequirePermission permission="view-ledgers">
                          <LazyAccountingStructureAuditPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/accounting-integrity"
                      element={
                        <RequirePermission permission="view-ledgers">
                          <LazyAccountingIntegrityAuditPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/financial-readiness"
                      element={
                        <RequirePermission permission="view-ledgers">
                          <LazyFinancialStatementReadinessAuditPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/godowns"
                      element={
                        <RequirePermission permission="view-inventory">
                          <LazyGodownList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/godowns/new"
                      element={
                        <RequirePermission permission="manage-inventory">
                          <LazyGodownForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/godowns/:id/edit"
                      element={
                        <RequirePermission permission="manage-inventory">
                          <LazyGodownForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/inventory-items"
                      element={<Navigate to="/items" replace />}
                    />
                    <Route
                      path="masters/inventory-items/new"
                      element={<Navigate to="/items?new=1" replace />}
                    />
                    <Route
                      path="masters/inventory-items/:id/edit"
                      element={<RedirectInventoryItemEdit />}
                    />
                    <Route
                      path="masters/inventory-items/:id"
                      element={<Navigate to="/items" replace />}
                    />
                    <Route
                      path="masters/price-lists"
                      element={
                        <RequirePermission permission="view-inventory">
                          <LazyPriceListList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/price-lists/new"
                      element={
                        <RequirePermission permission="manage-inventory">
                          <LazyPriceListForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/price-lists/report"
                      element={<Navigate to="/items/price-lists" replace />}
                    />
                    <Route
                      path="masters/price-lists/:id/edit"
                      element={
                        <RequirePermission permission="manage-inventory">
                          <LazyPriceListForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/stock-adjustments"
                      element={
                        <RequirePermission permission="view-inventory">
                          <LazyStockAdjustmentList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="masters/stock-adjustments/new"
                      element={
                        <RequirePermission permission="manage-inventory">
                          <LazyStockAdjustmentForm />
                        </RequirePermission>
                      }
                    />
                    <Route path="import/erp" element={<LazyImportFromErp />} />
                    <Route
                      path="approvals/pending"
                      element={
                        <RequirePermission permission="manage-users">
                          <LazyApprovalPendingPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/sales"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <LazySalesVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/sales/new"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <LazySalesVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/sales/:id/edit"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <LazySalesVoucherForm />
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
                          <LazyPurchaseVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/purchase/new"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <LazyPurchaseVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/purchase/:id/edit"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <LazyPurchaseVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/purchase-return"
                      element={
                        <RequirePermission permission="view-vouchers">
                          <LazyPurchaseReturnVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/purchase-return/new"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <LazyPurchaseReturnVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/payment-vouchers"
                      element={
                        <RequirePermission permission="view-vouchers">
                          <LazyPaymentVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/money/new"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
                            <LazyPaymentVoucherPage includeExpenseLedgersInParticulars fullScreenMode />
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
                            <LazyPaymentVoucherPage includeExpenseLedgersInParticulars initialType="PAYMENT" forceModernView />
                          </Suspense>
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/receipt-vouchers"
                      element={
                        <RequirePermission permission="view-vouchers">
                          <LazyReceiptVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/receipt-vouchers/:id/edit"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
                            <LazyPaymentVoucherPage includeExpenseLedgersInParticulars initialType="RECEIPT" forceModernView />
                          </Suspense>
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/journal"
                      element={
                        <RequirePermission permission="view-vouchers">
                          <LazyJournalVoucherList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="vouchers/journal/new"
                      element={
                        <RequirePermission permission="create-vouchers">
                          <LazyJournalVoucherForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="day-book"
                      element={
                        <RequirePermission permission="view-reports">
                          <DayBookPage />
                        </RequirePermission>
                      }
                    />
                    <Route path="reports" element={<Reports />} />
                    <Route path="dashboard/drill/:kind" element={<LazyDashboardKpiDrillPage />} />
                    <Route path="reports/outstanding-aging" element={<LazyOutstandingAgingReport />} />
                    <Route path="reports/party-outstanding" element={<LazyPartyOutstandingReport />} />
                    <Route path="reports/customer-ageing" element={<Navigate to="/reports/outstanding-aging" replace />} />
                    <Route path="reports/low-stock" element={<LazyLowStockReport />} />
                    <Route path="gst" element={<GSTReports />} />
                    <Route path="gst/gstr1" element={<LazyGSTR1Report />} />
                    <Route path="gst/gstr2" element={<LazyGSTR2Report />} />
                    <Route path="gst/gstr3b" element={<LazyGSTR3BReport />} />
                    <Route path="gst/gstr9" element={<LazyGSTR9Report />} />
                    <Route path="gst/hsn-summary" element={<LazyHSNSummary />} />
                    <Route path="gst/e-way-bill" element={<LazyEWayBillPage />} />
                    <Route path="utilities/e-way-bill" element={<Navigate to="/gst/e-way-bill" replace />} />
                    <Route path="user-management" element={<Navigate to="/settings" replace />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="store" element={<LazyStorePage />} />
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

          {/* Catch-all last — never Navigate to "/" unless Layout shell is mounted. */}
          <Route
            path="*"
            element={
              isAuthenticated ? (
                !licenseCheckDone ? (
                  startupGateSpinner
                ) : !licenseValid ? (
                  <Navigate to="/activate" replace />
                ) : companyGate === 'loading' ? (
                  startupGateSpinner
                ) : companyGate === 'select' ? (
                  <Navigate to="/select-company" replace />
                ) : profileCompleted ? (
                  shellReady ? (
                    <Navigate to="/dashboard" replace />
                  ) : (
                    startupGateSpinner
                  )
                ) : (
                  <Navigate to="/business-profile" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          </Routes>
          </Suspense>
        </Router>
        </Box>
      </FocusProvider>
      </Box>
      <SuperAdminPanel open={superAdminOpen} onClose={() => setSuperAdminOpen(false)} />
    </>
  );
}

export default App;
