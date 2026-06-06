// D:\PVEB\desktop\src\components\Layout.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Toolbar,
  Typography,
  Divider,
  Stack,
  Snackbar,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Alert,
  Button,
  TextField,
  InputAdornment,
  Badge,
  CircularProgress,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import FeedbackIcon from "@mui/icons-material/Feedback";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import CheckIcon from "@mui/icons-material/Check";
import { useTheme } from "@mui/material/styles";
import { usePveThemeOptional } from "../theme/themeProvider";
import { applyAppearanceAndNotify, readAppearance } from "../theme/appearanceSettings";
import type { ThemeMode } from "../theme/themeProvider";
import { useAuth } from "../pages/contexts/auth";
import { usePermissions } from "../hooks/usePermissions";
import { useUserDisplayName } from "../hooks/useUserDisplayName";
import { getAppSettings } from '../services/appSettingsService';
import FeedbackDialog from "./FeedbackDialog";
import { checkForAppUpdate, resolveDownloadUrl, type AppReleaseInfo } from "../services/appUpdateService";
import { openExternalUrl } from "../services/printService";
import { isElectronRuntime } from "../utils/runtime";
import { isBlockingOverlayForEscape } from "../utils/isBlockingOverlayForEscape";
import { resolveEscapeBackAction } from "../utils/escapeBackNavigation";
import { APP_QUIT_REQUEST_EVENT, quitApplication, requestAppQuit } from "../utils/appQuit";
import AppQuitDialog from "./AppQuitDialog";
import AIAssistant from "./AIAssistant.jsx";
import { dueReminderService, type DueReminder } from "../services/reminders/dueReminderService";
import ElectronTitleBar, {
  ELECTRON_TITLEBAR_HEIGHT_PX,
  electronUsesFramelessChrome,
} from "./ElectronTitleBar";
import AppTopBar from "./AppTopBar";
import { APP_DISPLAY_NAME, APP_VERSION } from "@/constants/appBranding";
import {
  DesktopErpTitleBar,
  DesktopErpMenuBar,
  DesktopErpStatusBar,
  ERP_MENU_ROW_PX,
  ERP_TITLE_ROW_PX,
  getErpFlatNavLinks,
  erpNavigateTo,
} from "./erp/DesktopErpChrome";
import { DesktopLeftSidebar } from "./erp/DesktopLeftSidebar";
import { QuickAddMenu } from "./erp/QuickAddMenu";
import { ERP_PRIMARY_MODULES } from "../config/erpModuleNav";
import { getErpChromeColors } from "../theme/erpColors";
import { pageHasOwnHeading } from "../utils/pageChrome";

// Page title mapping
const getPageTitle = (pathname: string): { title: string; showBackButton: boolean } => {
  const routeMap: Record<string, { title: string; showBackButton: boolean }> = {
    '/dashboard': { title: 'Dashboard', showBackButton: false },
    '/items': { title: 'Items', showBackButton: false },
    '/banking': { title: 'Banking', showBackButton: false },
    '/sales': { title: 'Sales', showBackButton: false },
    '/purchase': { title: 'Purchase', showBackButton: false },
    '/products': { title: 'Inventory Items', showBackButton: false },
    '/products/new': { title: 'Add Inventory Item', showBackButton: true },
    '/products/edit': { title: 'Edit Inventory Item', showBackButton: true },
    '/customers': { title: 'Customers', showBackButton: false },
    '/customers/ledger-report': { title: 'Ledger Report', showBackButton: true },
    '/parties': { title: 'Customers', showBackButton: false },
    '/parties/new': { title: 'New Party', showBackButton: true },
    '/parties/edit': { title: 'Edit Party', showBackButton: true },
    '/parties/ledger-report': { title: 'Ledger Report', showBackButton: true },
    '/reports/outstanding-aging': { title: 'Outstanding Aging', showBackButton: true },
    '/reports/low-stock': { title: 'Low Stock Products', showBackButton: true },
    '/invoices': { title: 'Invoices', showBackButton: false },
    '/purchase-invoices': { title: 'Purchase Bills', showBackButton: false },
    '/credit-notes': { title: 'Credit Notes (Sales Return)', showBackButton: false },
    '/debit-notes': { title: 'Debit Notes (Purchase Return)', showBackButton: false },
    '/accounts': { title: 'Accounts', showBackButton: false },
    '/accounts/new': { title: 'Add Account', showBackButton: true },
    '/accounts/edit': { title: 'Edit Account', showBackButton: true },
    '/expenses': { title: 'Expenses', showBackButton: false },
    '/expenses/new': { title: 'New Expense', showBackButton: true },
    '/expenses/edit': { title: 'Edit Expense', showBackButton: true },
    '/vouchers': { title: 'Vouchers', showBackButton: false },
    '/vouchers/money': { title: 'Payment & Receipt', showBackButton: false },
    '/vouchers/sales': { title: 'Sales Vouchers', showBackButton: false },
    '/vouchers/sales/new': { title: 'New Sales Voucher', showBackButton: true },
    '/vouchers/sales/new-staged': { title: 'New Sales Voucher', showBackButton: true },
    '/vouchers/sales/edit': { title: 'Edit Sales Voucher', showBackButton: true },
    '/vouchers/sales-return': { title: 'Sales Return Vouchers', showBackButton: false },
    '/vouchers/sales-return/new': { title: 'New Sales Return', showBackButton: true },
    '/vouchers/sales-return/edit': { title: 'Edit Sales Return', showBackButton: true },
    '/vouchers/purchase': { title: 'Purchase Vouchers', showBackButton: false },
    '/vouchers/purchase/new': { title: 'New Purchase Voucher', showBackButton: true },
    '/vouchers/purchase/edit': { title: 'Edit Purchase Voucher', showBackButton: true },
    '/vouchers/purchase-return': { title: 'Purchase Return Vouchers', showBackButton: false },
    '/vouchers/purchase-return/new': { title: 'New Purchase Return', showBackButton: true },
    '/vouchers/purchase-return/edit': { title: 'Edit Purchase Return', showBackButton: true },
    '/vouchers/payment-vouchers': { title: 'Payment Vouchers', showBackButton: false },
    '/vouchers/payment-vouchers/new': { title: 'New Payment Voucher', showBackButton: true },
    '/vouchers/receipt-vouchers': { title: 'Receipt Vouchers', showBackButton: false },
    '/vouchers/receipt-vouchers/new': { title: 'New Receipt Voucher', showBackButton: true },
    '/vouchers/money/new': { title: 'New Payment / Receipt Voucher', showBackButton: true },
    '/payments': { title: 'Payments', showBackButton: false },
    '/payments/new': { title: 'New Payment', showBackButton: true },
    '/payments/edit': { title: 'Edit Payment', showBackButton: true },
    '/vouchers/journal': { title: 'Journal Vouchers', showBackButton: false },
    '/vouchers/journal/new': { title: 'New Journal Voucher', showBackButton: true },
    '/vouchers/journal/edit': { title: 'Edit Journal Voucher', showBackButton: true },
    '/masters/godowns': { title: 'Godowns', showBackButton: false },
    '/masters/godowns/new': { title: 'New Godown', showBackButton: true },
    '/masters/godowns/edit': { title: 'Edit Godown', showBackButton: true },
    '/masters/inventory-items': { title: 'Inventory Items', showBackButton: false },
    '/masters/inventory-items/new': { title: 'Add Inventory Item', showBackButton: true },
    '/masters/inventory-items/edit': { title: 'Edit Inventory Item', showBackButton: true },
    '/masters/price-lists': { title: 'Price Lists', showBackButton: false },
    '/masters/price-lists/new': { title: 'New Price List', showBackButton: true },
    '/masters/stock-adjustments': { title: 'Stock Adjustments', showBackButton: false },
    '/masters/stock-adjustments/new': { title: 'New Stock Adjustment', showBackButton: true },
    '/expenses/heads/new': { title: 'Add Expense Head', showBackButton: true },
    '/expenses/heads/edit': { title: 'Edit Expense Head', showBackButton: true },
    '/gst': { title: 'GST Reports', showBackButton: false },
    '/gst/gstr1': { title: 'GSTR-1 (Sales Return)', showBackButton: true },
    '/gst/gstr2': { title: 'GSTR-2 (Purchase Return)', showBackButton: true },
    '/gst/gstr3b': { title: 'GSTR-3B (Monthly Return)', showBackButton: true },
    '/gst/gstr9': { title: 'GSTR-9 (Annual Return)', showBackButton: true },
    '/gst/hsn-summary': { title: 'HSN Summary', showBackButton: true },
    '/schemes': { title: 'Schemes', showBackButton: false },
    '/schemes/new': { title: 'New Scheme', showBackButton: true },
    '/schemes/edit': { title: 'Edit Scheme', showBackButton: true },
    '/reports': { title: 'Reports', showBackButton: false },
    '/settings': { title: 'Settings', showBackButton: false },
    '/masters/ledger-accounts': { title: 'Ledger Accounts', showBackButton: false },
    '/masters/ledger-accounts/new': { title: 'New Ledger Account', showBackButton: true },
    '/masters/ledger-accounts/edit': { title: 'Edit Ledger Account', showBackButton: true },
    '/import/erp': { title: 'Upload from Tally/Busy/Marg', showBackButton: false },
    '/approvals/pending': { title: 'Approval Pending', showBackButton: false },
  };

  const isNewOrEdit = pathname.includes('/new') || pathname.includes('/edit');

  // Find exact match first
  if (routeMap[pathname]) {
    return routeMap[pathname];
  }

  if (pathname.startsWith('/parties/party-ledger/')) {
    return { title: 'Party Ledger', showBackButton: true };
  }

  // Check for pattern matches (for edit routes with IDs)
  for (const [route, config] of Object.entries(routeMap)) {
    if (pathname.startsWith(route) && route !== pathname) {
      return config;
    }
  }

  // Special handling for wildcard routes
  if (pathname.startsWith('/expenses')) {
    return { title: 'Expenses', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/masters/inventory-items')) {
    if (pathname.endsWith('/new') || pathname.includes('/edit')) {
      return { title: pathname.includes('/edit') ? 'Edit Inventory Item' : 'Add Inventory Item', showBackButton: true };
    }
    if (/^\/masters\/inventory-items\/[^/]+$/.test(pathname)) {
      return { title: 'Item Details', showBackButton: true };
    }
    return { title: 'Inventory Items', showBackButton: false };
  }
  if (pathname.startsWith('/masters/price-lists')) {
    return { title: 'Price Lists', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/masters/stock-adjustments')) {
    return { title: 'Stock Adjustments', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/items')) {
    if (pathname.includes('price-lists')) return { title: 'Price Lists', showBackButton: false };
    if (pathname.includes('adjustments')) return { title: 'Inventory Adjustments', showBackButton: false };
    return { title: 'Items', showBackButton: false };
  }
  if (pathname.startsWith('/sales')) {
    const parts = pathname.split('/').filter(Boolean);
    const segment = parts[1];
    if (segment === 'invoices' && parts[2]) {
      return { title: 'Tax Invoice', showBackButton: true };
    }
    if (segment === 'collections' && (parts[2] === 'new' || parts[3] === 'edit')) {
      return { title: parts[2] === 'new' ? 'Record Collection' : 'Edit Collection', showBackButton: true };
    }
    const labels: Record<string, string> = {
      quotations: 'Quotations',
      proforma: 'Proforma Invoices',
      'sales-orders': 'Sales Orders',
      dispatch: 'Dispatch Notes',
      'tax-invoices': 'Tax Invoices',
      collections: 'Collections',
      'credit-adjustments': 'Credit Adjustments',
      recurring: 'Recurring Billing',
    };
    return { title: labels[segment ?? ''] ?? 'Sales Management', showBackButton: false };
  }
  return { title: APP_DISPLAY_NAME, showBackButton: false };
};

function readCompanyOwnerName(): string {
  try {
    const raw = localStorage.getItem("company-info");
    if (!raw) return "";
    const p = JSON.parse(raw) as { name?: string; businessName?: string };
    return String(p?.name ?? p?.businessName ?? localStorage.getItem('companyName') ?? "").trim();
  } catch {
    return "";
  }
}

/** Prefer real name in header; avoid showing raw email when fullName was set equal to email. */
function resolveHeaderDisplayName(user: Record<string, unknown> | null | undefined, companyOwnerName: string): string {
  if (!user) return "User";
  const email = String(user.email ?? "").trim().toLowerCase();
  const fullName = String(user.fullName ?? "").trim();
  const displayName = String((user as { displayName?: string }).displayName ?? "").trim();
  const username = String(user.username ?? "").trim();
  const emailLike = (s: string) => s.includes("@");

  if (fullName && fullName.toLowerCase() !== email) return fullName;
  if (companyOwnerName) return companyOwnerName;
  if (displayName) return displayName;
  if (username && !emailLike(username)) return username;
  if (email) {
    const local = email.split("@")[0];
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  if (fullName) return fullName;
  return "User";
}

const Layout: React.FC = () => {
  const [mobileNavAnchor, setMobileNavAnchor] = useState<null | HTMLElement>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [appUpdate, setAppUpdate] = useState<{
    currentVersion: string;
    info: AppReleaseInfo;
  } | null>(null);
  const [updateCheck, setUpdateCheck] = useState<{
    currentVersion: string;
    updateAvailable: boolean;
    belowMinimum: boolean;
    info: AppReleaseInfo | null;
  } | null>(null);
  const [updateMenuAnchor, setUpdateMenuAnchor] = useState<null | HTMLElement>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [adminUpdateBell, setAdminUpdateBell] = useState(false);
  const [dueReminders, setDueReminders] = useState<DueReminder[]>([]);
  const [dueToastOpen, setDueToastOpen] = useState(false);
  const [dueToastItem, setDueToastItem] = useState<DueReminder | null>(null);
  const [screenLocked, setScreenLocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [lockError, setLockError] = useState<string | null>(null);
  const [quitConfirmOpen, setQuitConfirmOpen] = useState(false);

  const [appSettings, setAppSettings] = useState(() => getAppSettings());

  const navigate = useNavigate();
  const location = useLocation();
  const muiTheme = useTheme();
  const pveTheme = usePveThemeOptional();
  const isDark = pveTheme?.isDark ?? muiTheme.palette.mode === 'dark';
  const mode: ThemeMode = pveTheme?.mode ?? (isDark ? 'dark' : 'light');
  const setMode =
    pveTheme?.setMode ??
    ((next: ThemeMode) => {
      applyAppearanceAndNotify(next === 'dark' ? 'premium-dark' : 'light', readAppearance().accent);
    });
  const chrome = useMemo(() => getErpChromeColors(isDark ? 'premium-dark' : 'light'), [isDark]);
  const { user, logout } = useAuth();
  const { canAccessFeature } = usePermissions();

  const [companyOwnerName, setCompanyOwnerName] = useState(() => readCompanyOwnerName());

  useEffect(() => {
    const onCompanyUpdate = () => setCompanyOwnerName(readCompanyOwnerName());
    window.addEventListener("companyProfileUpdated", onCompanyUpdate);
    return () => window.removeEventListener("companyProfileUpdated", onCompanyUpdate);
  }, []);

  const userPhotoUrl = String(
    (user as any)?.photoUrl ??
      (user as any)?.photo ??
      (user as any)?.avatarUrl ??
      (user as any)?.avatar ??
      (user as any)?.profileImage ??
      (user as any)?.profilePhoto ??
      ''
  ).trim();
  const userHasPhoto = !!userPhotoUrl;
  const userFullName = useUserDisplayName();
  const userInitials = userFullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || 'U';

  const normalizedPathname =
    String(location.pathname ?? '').replace(/\/+$/, '') || '/';
  const { title: pageTitle, showBackButton } = getPageTitle(normalizedPathname);
  const hideToolbarTitle = pageHasOwnHeading(normalizedPathname);
  const showSecondaryToolbar = !hideToolbarTitle || showBackButton;
  const gstEnabled = Boolean(appSettings?.features?.gstEnabled);
  const erpMobileLinks = useMemo(
    () => getErpFlatNavLinks(canAccessFeature, gstEnabled),
    [canAccessFeature, gstEnabled]
  );
  const erpModuleLinks = useMemo(
    () =>
      ERP_PRIMARY_MODULES.filter((m) => {
        if (m.gstOnly && !gstEnabled) return false;
        if (m.perm && !canAccessFeature(m.perm)) return false;
        return true;
      }),
    [canAccessFeature, gstEnabled]
  );

  useEffect(() => {
    const onSettings = () => setAppSettings(getAppSettings());
    window.addEventListener('appSettingsUpdated', onSettings as any);
    return () => window.removeEventListener('appSettingsUpdated', onSettings as any);
  }, []);

  const applyUpdateCheckResult = useCallback((r: Awaited<ReturnType<typeof checkForAppUpdate>>) => {
    setUpdateCheck({
      currentVersion: r.currentVersion,
      updateAvailable: r.updateAvailable,
      belowMinimum: r.belowMinimum,
      info: r.info,
    });
    if (!r.info) {
      setAppUpdate(null);
      return;
    }
    const mustShow = r.belowMinimum || r.updateAvailable;
    if (!mustShow) {
      setAppUpdate(null);
      return;
    }
    const dismissed = sessionStorage.getItem('app_update_dismissed_version');
    if (!r.belowMinimum && dismissed === r.info.latestVersion) {
      setAppUpdate(null);
      return;
    }
    const info =
      r.belowMinimum && !r.info.mandatory ? { ...r.info, mandatory: true } : r.info;
    setAppUpdate({ currentVersion: r.currentVersion, info });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await checkForAppUpdate();
        if (cancelled) return;
        applyUpdateCheckResult(r);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyUpdateCheckResult]);

  const pendingAppUpdate = Boolean(updateCheck?.updateAvailable || updateCheck?.belowMinimum);

  useEffect(() => {
    const syncAdminBell = () => {
      try {
        setAdminUpdateBell(sessionStorage.getItem('pve_has_admin_update_notice') === '1');
      } catch {
        setAdminUpdateBell(false);
      }
    };
    syncAdminBell();
    window.addEventListener('pve-update-notice-changed', syncAdminBell);
    return () => window.removeEventListener('pve-update-notice-changed', syncAdminBell);
  }, []);

  const showNotificationBellDot =
    pendingAppUpdate || adminUpdateBell || dueReminders.length > 0;

  const closeUpdateMenu = useCallback(() => {
    setUpdateMenuAnchor(null);
  }, []);

  useEffect(() => {
    const runDueReminderCheck = () => {
      try {
        const list = dueReminderService.listUpcoming(7);
        setDueReminders(list);
        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const toastKey = localStorage.getItem('pve_due_reminder_toast_date');
        if (list.length > 0 && toastKey !== todayKey) {
          setDueToastItem(list[0]);
          setDueToastOpen(true);
          localStorage.setItem('pve_due_reminder_toast_date', todayKey);
        }
      } catch {
        setDueReminders([]);
      }
    };

    const markKey = 'pve_due_reminder_last_run_date';
    const shouldRunNow = () => {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const last = localStorage.getItem(markKey);
      if (last !== todayKey) return true; // morning open case
      return now.getHours() >= 11; // ensure at/after 11am refresh
    };
    const markRanToday = () => {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      localStorage.setItem(markKey, todayKey);
    };
    const maybeRun = () => {
      if (!shouldRunNow()) return;
      runDueReminderCheck();
      markRanToday();
    };

    // On app open
    maybeRun();
    // Keep daily 11:00 check while app stays open
    const id = window.setInterval(maybeRun, 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const runManualUpdateCheck = useCallback(async () => {
    setUpdateChecking(true);
    try {
      const r = await checkForAppUpdate();
      applyUpdateCheckResult(r);
    } catch {
      // ignore
    } finally {
      setUpdateChecking(false);
    }
  }, [applyUpdateCheckResult]);

  const openReleaseDownload = useCallback(async () => {
    const url = resolveDownloadUrl(updateCheck?.info ?? appUpdate?.info ?? null);
    setUpdateMenuAnchor(null);
    await openExternalUrl(url);
  }, [updateCheck?.info, appUpdate?.info]);

  const handleBackNavigation = useCallback(() => {
    const idx = Number((window.history.state as { idx?: number })?.idx ?? -1);
    const historyCanGoBack = Number.isFinite(idx) ? idx > 0 : window.history.length > 1;
    const action = resolveEscapeBackAction(location.pathname, location.search, historyCanGoBack);

    if (action.type === 'history') {
      navigate(-1);
      return;
    }
    if (action.type === 'navigate') {
      navigate(action.to);
      return;
    }
    requestAppQuit();
  }, [navigate, location.pathname, location.search]);

  useEffect(() => {
    const onQuitRequest = () => setQuitConfirmOpen(true);
    window.addEventListener(APP_QUIT_REQUEST_EVENT, onQuitRequest);
    return () => window.removeEventListener(APP_QUIT_REQUEST_EVENT, onQuitRequest);
  }, []);

  /** Escape = same as header back (when no modal/menu is eating the key). */
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      const el = e.target as HTMLElement | null;
      if (el?.closest?.('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')) return;
      if (el?.closest?.('[data-tally-picker-modal]')) return;
      if (el?.closest?.('.MuiPopover-root, .MuiMenu-root, .MuiAutocomplete-popper, [role="listbox"]')) return;
      // Capture runs before dialog handlers; detect open MUI layers even if focus is not on the paper yet.
      if (isBlockingOverlayForEscape()) return;

      e.preventDefault();
      handleBackNavigation();
    };
    window.addEventListener('keydown', onEscape, true);
    return () => window.removeEventListener('keydown', onEscape, true);
  }, [location.pathname, handleBackNavigation]);

  /** F1 → About & Updates (when permitted), Tally-style help entry. */
  useEffect(() => {
    const isShortcutBlockedByTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el?.isConnected) return false;
      if (
        el.closest(
          '[role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-tally-picker-modal], .MuiPopover-root, .MuiMenu-root'
        )
      )
        return true;
      return false;
    };

    const onFunctionKey = (e: KeyboardEvent) => {
      if (isBlockingOverlayForEscape()) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (isShortcutBlockedByTarget(e.target)) return;
        const altKey = String(e.key || '').toUpperCase();
        const altRoutes: Record<string, string> = {
          S: '/settings',
          C: '/settings?tab=companydesk',
          D: '/dashboard',
          L: '/masters/ledger-accounts',
          B: '/masters/bank-accounts',
          G: '/masters/godowns',
          I: '/masters/inventory-items',
          R: '/parties/ledger-report',
          '3': '/vouchers/sales-return',
          '4': '/vouchers/purchase-return',
          P: '/vouchers/payment',
          V: '/vouchers/receipt',
          J: '/vouchers/journal',
          K: '/vouchers',
          E: '/expenses',
          Y: '/payments',
          N: '/purchase-invoices',
          '6': '/reports',
          Q: '/reports?view=financial&report=balancesheet',
          W: '/reports?view=pre-gst-profit&report=pnl',
          T: '/schemes?view=traditional',
          U: '/schemes?view=smart&tab=create',
          M: '/schemes?view=smart&tab=dashboard',
          O: '/schemes?view=smart&tab=payment',
          A: '/schemes?view=smart&tab=achievement',
          X: '/import/erp',
          H: '/approvals/pending',
        };
        const nextRoute = altRoutes[altKey];
        if (nextRoute) {
          e.preventDefault();
          const qIdx = nextRoute.indexOf('?');
          if (qIdx >= 0) {
            navigate({ pathname: nextRoute.slice(0, qIdx), search: nextRoute.slice(qIdx) });
          } else {
            navigate(nextRoute);
          }
          return;
        }
      }

      const rawKey = String(e.key || '').toUpperCase();
      const code = String((e as KeyboardEvent).code || '').toUpperCase();
      const keyCode = Number((e as KeyboardEvent).keyCode || 0);
      const looksLikeFunctionKey =
        /^F\d{1,2}$/i.test(rawKey) ||
        /^F\d{1,2}$/i.test(code) ||
        (keyCode >= 112 && keyCode <= 123);
      if (!looksLikeFunctionKey) return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      if (isShortcutBlockedByTarget(e.target)) return;
      const key = /^F\d{1,2}$/i.test(rawKey)
        ? rawKey
        : /^F\d{1,2}$/i.test(code)
        ? code
        : keyCode >= 112 && keyCode <= 123
        ? `F${keyCode - 111}`
        : rawKey;

      if (key === 'F1') {
        if (!canAccessFeature('manage-settings')) return;
        e.preventDefault();
        navigate({ pathname: '/settings', search: '?tab=about' });
      return;
    }
      if (key === 'F2') {
        e.preventDefault();
        navigate('/parties');
      return;
    }
      if (key === 'F3') {
        e.preventDefault();
        navigate('/vouchers/sales/new');
      return;
    }
      if (key === 'F4') {
        e.preventDefault();
        navigate('/vouchers/purchase/new');
        return;
      }
      if (key === 'F6') {
        e.preventDefault();
        navigate('/reports');
        return;
      }
      if (key === 'F7') {
        e.preventDefault();
        navigate('/gst');
        return;
      }
      if (key === 'F8') {
        e.preventDefault();
        navigate('/payments');
      }
    };

    window.addEventListener('keydown', onFunctionKey, true);
    return () => window.removeEventListener('keydown', onFunctionKey, true);
  }, [navigate, canAccessFeature]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const openDueReminderTarget = useCallback((rem: DueReminder) => {
    setDueToastOpen(false);
    setUpdateMenuAnchor(null);
    if (rem.voucherType === 'SALES') {
      navigate('/vouchers/sales');
      return;
    }
    navigate('/vouchers/purchase');
  }, [navigate]);

  const handleLockScreen = useCallback(() => {
    const pinKey = 'pve_screen_lock_pin';
    let pin = String(localStorage.getItem(pinKey) || '').trim();
    if (!pin) {
      const created = window.prompt('Set 4-digit lock PIN (first time setup):', '');
      if (!created) return;
      pin = String(created).trim();
      if (pin.length < 4) {
        alert('PIN must be at least 4 characters.');
        return;
      }
      localStorage.setItem(pinKey, pin);
    }
    setUnlockPin('');
    setLockError(null);
    setScreenLocked(true);
    handleMenuClose();
  }, []);

  const handleUnlock = useCallback(() => {
    const pin = String(localStorage.getItem('pve_screen_lock_pin') || '').trim();
    if (!pin) {
      setScreenLocked(false);
      return;
    }
    if (unlockPin.trim() !== pin) {
      setLockError('Invalid PIN. Try again.');
      return;
    }
    setLockError(null);
    setUnlockPin('');
    setScreenLocked(false);
  }, [unlockPin]);

  const [headerSearch, setHeaderSearch] = useState('');
  const headerSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        headerSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = () => {
    // AuthContext se logout
    logout();
    handleMenuClose();
    // turant login page par redirect
    navigate("/login");
  };

  const shouldShowHeaderSearch = !showBackButton;
  const submitHeaderSearch = () => {
    const q = headerSearch.trim();
    if (!q) {
      navigate('/dashboard');
      return;
    }
    const s = q.toLowerCase();
    if (s.includes('invoice') || s.includes('sale') || s.includes('billing')) {
      navigate('/vouchers');
      return;
    }
    if (s.includes('purchase') || s.includes('buy')) {
      navigate('/purchase-invoices');
      return;
    }
    if (s.includes('payment') || s.includes('receipt') || s.includes('collect')) {
      navigate('/payments');
      return;
    }
    if (s.includes('customer') || s.includes('supplier') || s.includes('party')) {
      navigate('/parties');
      return;
    }
    if (s.includes('product') || s.includes('item') || s.includes('inventory') || s.includes('stock')) {
      navigate(`/items?q=${encodeURIComponent(q)}`);
      return;
    }
    if (s.includes('expense') || s.includes('spend')) {
      navigate('/expenses');
      return;
    }
    if (s.includes('account') || s.includes('ledger') || s.includes('bank') || s.includes('cash')) {
      navigate('/accounts');
      return;
    }
    if (s.includes('gst') || s.includes('report')) {
      navigate('/reports');
      return;
    }
    navigate(`/items?q=${encodeURIComponent(q)}`);
  };

  const headerSearchField = shouldShowHeaderSearch ? (
    <TextField
      size="small"
      fullWidth
      inputRef={headerSearchRef}
      placeholder="Search invoices, customers, items, reports..."
      value={headerSearch}
      onChange={(e) => setHeaderSearch(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitHeaderSearch();
        }
      }}
      inputProps={{
        'aria-label': 'Global search',
        title: 'Search invoices, customers, items, reports. Ctrl+K to focus.',
      }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: '#64748B', fontSize: 20 }} />
          </InputAdornment>
        ),
        endAdornment: (
          <InputAdornment position="end">
            <Box
              component="kbd"
              sx={{
                display: { xs: 'none', md: 'inline-flex' },
                alignItems: 'center',
                px: 0.75,
                py: 0.25,
                fontSize: '0.6875rem',
                fontWeight: 700,
                fontFamily: 'ui-monospace, monospace',
                color: '#64748B',
                bgcolor: '#F1F5F9',
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                lineHeight: 1.2,
              }}
            >
              Ctrl+K
            </Box>
          </InputAdornment>
        ),
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          height: 36,
          bgcolor: muiTheme.palette.background.paper,
          borderRadius: '16px',
          color: muiTheme.palette.text.primary,
          fontSize: '0.8125rem',
          fontFamily: '"Inter", system-ui, sans-serif',
          transition: muiTheme.transitions.create(['box-shadow', 'border-color'], { duration: 300 }),
          boxShadow: isDark ? 'none' : '0 1px 3px rgba(15, 23, 42, 0.06)',
          '& fieldset': {
            borderColor: muiTheme.palette.divider,
          },
          '&:hover fieldset': {
            borderColor: muiTheme.palette.primary.main,
          },
          '&.Mui-focused': {
            boxShadow: isDark ? 'none' : `0 0 0 3px rgba(37, 99, 235, 0.12)`,
          },
          '&.Mui-focused fieldset': {
            borderColor: muiTheme.palette.primary.main,
            borderWidth: '1px',
          },
        },
        '& .MuiInputBase-input::placeholder': {
          color: muiTheme.palette.text.secondary,
          opacity: 1,
        },
      }}
    />
  ) : null;

  const titleBarOffset = electronUsesFramelessChrome() ? ELECTRON_TITLEBAR_HEIGHT_PX : 0;
  const TOOLBAR_ROW_XS = 48;
  const TOOLBAR_ROW_SM = 52;

              return (
                        <Box
                          sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
      }}
    >
      <ElectronTitleBar />
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          width: '100%',
          minHeight: 0,
          overflow: 'hidden',
          pt: titleBarOffset ? `${titleBarOffset}px` : 0,
        }}
      >
        <DesktopLeftSidebar canAccessFeature={canAccessFeature} gstEnabled={gstEnabled} />
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: 0, overflow: 'hidden', minWidth: 0 }}>
        <Box
        sx={(t) => ({
            position: 'sticky',
          top: 0,
          zIndex: t.zIndex.drawer + 1,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            boxShadow: '0 1px 0 rgba(15,23,42,0.12)',
            overflow: 'visible',
            bgcolor: chrome.headerBg,
          })}
        >
          <DesktopErpTitleBar
            leadingSlot={
              <IconButton
                color="inherit"
                aria-label="Open menu"
                onClick={(e) => setMobileNavAnchor(e.currentTarget)}
                sx={{ display: { sm: 'none' }, color: 'inherit', p: 0.35, ml: -0.25 }}
              >
                <MenuIcon sx={{ fontSize: 22 }} />
              </IconButton>
            }
            centerSlot={headerSearchField}
            rightSlot={
          <Box
            sx={{
                  display: 'flex',
              alignItems: 'center',
                  gap: 0.75,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 999,
                  border: `1px solid ${chrome.userGroupBorder}`,
                  bgcolor: chrome.userGroupBg,
                }}
              >
                <QuickAddMenu canAccessFeature={canAccessFeature} />
                <IconButton
                  color="inherit"
                  aria-label="Updates and notifications"
                  title="Notifications"
                  onClick={(e) => setUpdateMenuAnchor(e.currentTarget)}
                  sx={{ color: chrome.headerText, p: 0.5 }}
                >
                  <Badge
                    color="error"
                    variant="dot"
                    invisible={!showNotificationBellDot}
                    overlap="circular"
                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    <NotificationsOutlinedIcon sx={{ fontSize: 20 }} />
                  </Badge>
                </IconButton>
            <Typography
                  variant="body2"
                  sx={{ maxWidth: 170, display: { xs: 'none', md: 'block' }, color: chrome.headerText, fontWeight: 700 }}
              noWrap
                  title={userFullName}
                >
                  {userFullName}
            </Typography>
                <IconButton onClick={handleMenuOpen} color="inherit" sx={{ p: 0.2 }}>
                  <Avatar
                    src={userHasPhoto ? userPhotoUrl : undefined}
                    imgProps={{ referrerPolicy: 'no-referrer' }}
                    sx={{ width: 30, height: 30, bgcolor: 'secondary.main' }}
                  >
                    {userHasPhoto ? null : userInitials}
                  </Avatar>
          </IconButton>
              </Box>
            }
          />
          {/* Legacy top menu — replaced by left sidebar on sm+; mobile uses hamburger */}
          <Box sx={{ display: 'none', overflow: 'visible' }}>
            <DesktopErpMenuBar
              navigate={navigate}
              canAccessFeature={canAccessFeature}
              gstEnabled={gstEnabled}
            />
          </Box>
        {showSecondaryToolbar ? (
        <Toolbar
          disableGutters
                sx={{
            gap: 0,
              minHeight: { xs: TOOLBAR_ROW_XS, sm: TOOLBAR_ROW_SM },
              py: { xs: 0.25, sm: 0.35 },
            px: 0,
              bgcolor: chrome.toolbarBg,
              borderBottom: `1px solid ${chrome.toolbarBorder}`,
              color: chrome.text,
            }}
          >
          <AppTopBar
            wideSearch={false}
            left={
              <>
                <Box sx={{ minWidth: 0, pl: { xs: 0, sm: 0.5 } }}>
            <Typography
                    variant="subtitle1"
              noWrap
              component="div"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'inherit',
                      fontSize: { xs: '0.95rem', sm: '1rem' },
                      lineHeight: 1.2,
              }}
                    title={pageTitle}
            >
              {pageTitle}
            </Typography>
            <Typography
              variant="caption"
              noWrap
              sx={{
                      fontSize: '0.68rem',
                      opacity: 0.85,
                      mt: 0.15,
                    }}
                    title={`Version ${APP_VERSION}`}
                  >
                    v{APP_VERSION}
            </Typography>
          </Box>
              </>
            }
            center={<Box sx={{ width: '100%', height: 40 }} />}
            right={<Box sx={{ width: 8 }} />}
          />
          <Menu
            anchorEl={updateMenuAnchor}
            open={Boolean(updateMenuAnchor)}
            onClose={closeUpdateMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { minWidth: 288, mt: 1 } } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                App updates
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                This device: v{updateCheck?.currentVersion ?? '—'}
              </Typography>
              {updateCheck?.info?.latestVersion ? (
                <Typography variant="caption" color="text.secondary" display="block">
                  Latest (release info): v{updateCheck.info.latestVersion}
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary" display="block">
                  No release info loaded (offline or not configured).
                </Typography>
              )}
            </Box>
            <Divider />
            {updateCheck?.belowMinimum ? (
              <Alert severity="warning" sx={{ mx: 1, my: 1 }}>
                Your version is below the minimum supported. Please update soon.
              </Alert>
            ) : null}
            {updateCheck?.updateAvailable && updateCheck.info ? (
              <Typography variant="body2" sx={{ px: 2, py: 1 }}>
                A newer version is listed. Use Download to get the installer, or open About &amp; Updates
                {isElectronRuntime() ? ' for auto-update (when entitled).' : '.'}
              </Typography>
            ) : !updateChecking ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
                You are up to date with the published release info, or the server could not be reached.
              </Typography>
            ) : null}
            {updateChecking ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={28} />
              </Box>
            ) : null}
            <Divider />
            <Box sx={{ px: 2, py: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Due in next 7 days
              </Typography>
              {dueReminders.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  No customer/supplier dues in next 7 days.
                </Typography>
              ) : (
                <Stack spacing={0.5} sx={{ mt: 0.75, maxHeight: 200, overflowY: 'auto' }}>
                  {dueReminders.slice(0, 20).map((rem) => (
                    <Button
                      key={`${rem.voucherId}-${rem.voucherType}`}
                      onClick={() => openDueReminderTarget(rem)}
                      size="small"
                      sx={{ justifyContent: 'flex-start', textTransform: 'none', px: 0, minHeight: 24 }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
                        {rem.partyName} · {rem.voucherType === 'SALES' ? 'Receipt' : 'Payment'} due in {rem.daysLeft} day(s) ·
                        ₹{rem.balanceAmount.toFixed(2)}
                      </Typography>
                    </Button>
                  ))}
                </Stack>
              )}
            </Box>
            {pendingAppUpdate && updateCheck?.info?.releaseNotes ? (
              <>
                <Divider />
                <Box sx={{ px: 2, py: 1.25 }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    What&apos;s new
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {updateCheck.info.releaseNotes}
                  </Typography>
                </Box>
              </>
            ) : null}
            <Divider />
            <MenuItem
              disabled={updateChecking}
              onClick={() => {
                void runManualUpdateCheck();
              }}
            >
              Check for updates
            </MenuItem>
            {updateCheck?.updateAvailable && updateCheck.info ? (
              <MenuItem
                onClick={() => {
                  void openReleaseDownload();
                }}
              >
                Download v{updateCheck.info.latestVersion}
              </MenuItem>
            ) : null}
            {canAccessFeature('manage-settings') ? (
              <MenuItem
                onClick={() => {
                  setUpdateMenuAnchor(null);
                  navigate({ pathname: '/settings', search: '?tab=about' });
                }}
              >
                Open About &amp; Updates
              </MenuItem>
            ) : null}
          </Menu>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
          >
            <MenuItem disabled>
              <AccountCircleIcon sx={{ mr: 1 }} />
              <Typography variant="body2">
                {userFullName}
              </Typography>
            </MenuItem>
            <MenuItem disabled>
              <Typography variant="caption" color="text.secondary">
                {userFullName}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem
              selected={mode === 'light'}
              onClick={() => {
                setMode('light');
                handleMenuClose();
              }}
            >
              <LightModeIcon sx={{ mr: 1, fontSize: 20 }} />
              Light Mode
              {mode === 'light' ? <CheckIcon sx={{ ml: 'auto', fontSize: 18 }} /> : null}
            </MenuItem>
            <MenuItem
              selected={mode === 'dark'}
              onClick={() => {
                setMode('dark');
                handleMenuClose();
              }}
            >
              <DarkModeIcon sx={{ mr: 1, fontSize: 20 }} />
              Dark Mode
              {mode === 'dark' ? <CheckIcon sx={{ ml: 'auto', fontSize: 18 }} /> : null}
            </MenuItem>
            <Divider />
            {canAccessFeature('manage-settings') ? (
              <MenuItem
                onClick={() => {
                  navigate("/settings");
                  handleMenuClose();
                }}
              >
                <SettingsIcon sx={{ mr: 1 }} />
                Settings
              </MenuItem>
            ) : null}
            <MenuItem
              onClick={() => {
                setFeedbackOpen(true);
                handleMenuClose();
              }}
            >
              <FeedbackIcon sx={{ mr: 1 }} />
              Feedback to Developer
            </MenuItem>
            <MenuItem onClick={handleLockScreen}>
              <LockOutlinedIcon sx={{ mr: 1 }} />
              Lock Screen
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleMenuClose();
                requestAppQuit();
              }}
            >
              <ExitToAppIcon sx={{ mr: 1 }} />
              Exit Application
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
          <Menu
            anchorEl={mobileNavAnchor}
            open={Boolean(mobileNavAnchor)}
            onClose={() => setMobileNavAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{ paper: { sx: { minWidth: 260, maxHeight: '70vh', mt: 0.5 } } }}
            MenuListProps={{ dense: true }}
          >
            {erpModuleLinks.map((mod) => (
              <MenuItem
                key={`module-${mod.id}`}
                onClick={() => {
                  navigate(mod.path);
                  setMobileNavAnchor(null);
                }}
              >
                <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 700 }}>
                  {mod.label}
                </Typography>
              </MenuItem>
            ))}
            <Divider sx={{ my: 0.5 }} />
            {erpMobileLinks.map((it) => (
              <MenuItem
                key={`${it.path}-${it.label}`}
                onClick={() => {
                  erpNavigateTo(navigate, it.path);
                  setMobileNavAnchor(null);
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2 }}>
                    {it.group}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                    {it.label}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Menu>
        </Toolbar>
        ) : null}
        </Box>
      <Box
        component="main"
          sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.content',
          overflow: 'hidden',
        }}
      >
        <Box
          data-erp-dense
          sx={{
            flex: 1,
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            scrollPaddingBottom: '96px',
            px: { xs: 1, sm: 1.5 },
            py: 0.75,
            color: 'text.primary',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': {
              width: 0,
              height: 0,
              display: 'none',
            },
          }}
        >
        {appUpdate && (
          <Alert
            severity={appUpdate.info.mandatory ? 'warning' : 'info'}
            sx={{ mb: 2 }}
            action={
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Button
                  color="inherit"
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    void openExternalUrl(resolveDownloadUrl(appUpdate.info));
                  }}
                >
                  Download
                </Button>
                {!appUpdate.info.mandatory && (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => {
                      sessionStorage.setItem('app_update_dismissed_version', appUpdate.info.latestVersion);
                      setAppUpdate(null);
                    }}
                  >
                    Dismiss
                  </Button>
                )}
              </Box>
            }
          >
            <Typography variant="subtitle2" component="span" sx={{ display: 'block' }}>
              Update available: v{appUpdate.info.latestVersion} (you have v{appUpdate.currentVersion})
            </Typography>
            {appUpdate.info.releaseNotes ? (
              <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                {appUpdate.info.releaseNotes}
              </Typography>
            ) : null}
          </Alert>
        )}
        <Outlet />
        </Box>
        <DesktopErpStatusBar userLabel={userFullName.toUpperCase()} canAccessFeature={canAccessFeature} />
      </Box>
      </Box>
      </Box>
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
      <Snackbar
        open={dueToastOpen && Boolean(dueToastItem)}
        autoHideDuration={10000}
        onClose={() => setDueToastOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          severity="warning"
          action={
            dueToastItem ? (
              <Button color="inherit" size="small" onClick={() => openDueReminderTarget(dueToastItem)}>
                Open
              </Button>
            ) : null
          }
          onClose={() => setDueToastOpen(false)}
          sx={{ width: '100%' }}
        >
          {dueToastItem
            ? `${dueToastItem.partyName}: ${dueToastItem.voucherType === 'SALES' ? 'Receipt' : 'Payment'} due in ${dueToastItem.daysLeft} day(s).`
            : 'Due reminder'}
        </Alert>
      </Snackbar>
      {screenLocked ? (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            bgcolor: 'rgba(15,23,42,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper', borderRadius: 2, p: 2.5, border: 1, borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Screen Locked
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
              Enter lock PIN to continue.
            </Typography>
            <TextField
              fullWidth
              type="password"
              label="PIN"
              value={unlockPin}
              onChange={(e) => setUnlockPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUnlock();
              }}
            />
            {lockError ? <Alert severity="error" sx={{ mt: 1 }}>{lockError}</Alert> : null}
            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1.5 }}>
              <Button variant="contained" onClick={handleUnlock}>Unlock</Button>
            </Stack>
          </Box>
        </Box>
      ) : null}
      <AppQuitDialog
        open={quitConfirmOpen}
        onClose={() => setQuitConfirmOpen(false)}
        onConfirm={() => {
          setQuitConfirmOpen(false);
          quitApplication();
        }}
      />
      <AIAssistant />
    </Box>
  );
};

export default Layout;
