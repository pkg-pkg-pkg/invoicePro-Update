// D:\PVEB\desktop\src\components\Layout.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Toolbar,
  Typography,
  Divider,
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
import FeedbackIcon from "@mui/icons-material/Feedback";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useAuth } from "../pages/contexts/auth";
import { usePermissions } from "../hooks/usePermissions";
import { getAppSettings } from '../services/appSettingsService';
import FeedbackDialog from "./FeedbackDialog";
import { checkForAppUpdate, type AppReleaseInfo } from "../services/appUpdateService";
import { isElectronRuntime } from "../utils/runtime";
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
  ERP_TEXT,
  ERP_TITLE_ROW_PX,
  ERP_WORKSPACE_BG,
  getErpFlatNavLinks,
  erpNavigateTo,
} from "./erp/DesktopErpChrome";

// Page title mapping
const getPageTitle = (pathname: string): { title: string; showBackButton: boolean } => {
  const routeMap: Record<string, { title: string; showBackButton: boolean }> = {
    '/dashboard': { title: 'Dashboard', showBackButton: false },
    '/products': { title: 'Inventory Items', showBackButton: false },
    '/products/new': { title: 'Add Inventory Item', showBackButton: true },
    '/products/edit': { title: 'Edit Inventory Item', showBackButton: true },
    '/parties': { title: 'Party Master', showBackButton: false },
    '/parties/new': { title: 'New Party', showBackButton: true },
    '/parties/edit': { title: 'Edit Party', showBackButton: true },
    '/parties/ledger-report': { title: 'Ledger Report', showBackButton: true },
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
    return { title: 'Inventory Items', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/vouchers/sales')) {
    return { title: 'Sales Vouchers', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/vouchers/purchase')) {
    return { title: 'Purchase Vouchers', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/vouchers/payment-vouchers')) {
    return { title: 'Payment Vouchers', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/vouchers/receipt-vouchers')) {
    return { title: 'Receipt Vouchers', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/vouchers/journal')) {
    return { title: 'Journal Vouchers', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/payments')) {
    return { title: 'Payments', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/accounts')) {
    return { title: 'Accounts', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/parties')) {
    return { title: 'Party Master', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/masters/godowns')) {
    return { title: 'Godowns', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/schemes')) {
    return { title: 'Schemes', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/masters/ledger-accounts')) {
    return { title: 'Ledger Accounts', showBackButton: isNewOrEdit };
  }
  if (pathname.startsWith('/products')) {
    return { title: 'Inventory Items', showBackButton: isNewOrEdit };
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

  const [appSettings, setAppSettings] = useState(() => getAppSettings());

  const navigate = useNavigate();
  const location = useLocation();
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
  const userFullName = useMemo(
    () => resolveHeaderDisplayName(user as unknown as Record<string, unknown> | undefined, companyOwnerName),
    [user, companyOwnerName]
  );
  const userInitials = userFullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || 'U';

  const normalizedPathname =
    String(location.pathname ?? '').replace(/\/+$/, '') || '/';
  const { title: pageTitle, showBackButton } = getPageTitle(normalizedPathname);
  const gstEnabled = Boolean(appSettings?.features?.gstEnabled);
  const erpMobileLinks = useMemo(
    () => getErpFlatNavLinks(canAccessFeature, gstEnabled),
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

  const handleBackNavigation = useCallback(() => {
    const raw = String(location.pathname ?? '');
    const path = raw.replace(/\/+$/, '') || '/';

    if (path.startsWith('/customers/ledger') || path.startsWith('/suppliers/ledger')) {
      navigate('/parties/ledger-report');
      return;
    }
    if (path.startsWith('/parties/party-ledger')) {
      navigate('/parties/ledger-report');
      return;
    }
    if (path.startsWith('/vouchers/sales')) {
      navigate('/vouchers/sales');
      return;
    }
    if (path.startsWith('/vouchers/purchase')) {
      navigate('/vouchers/purchase');
      return;
    }
    if (path.startsWith('/vouchers/sales-return')) {
      navigate('/vouchers/sales-return');
      return;
    }
    if (path.startsWith('/vouchers/purchase-return')) {
      navigate('/vouchers/purchase-return');
      return;
    }
    if (path.startsWith('/vouchers/payment-vouchers')) {
      navigate('/vouchers/payment-vouchers');
      return;
    }
    if (path.startsWith('/vouchers/receipt-vouchers')) {
      navigate('/vouchers/receipt-vouchers');
      return;
    }
    if (path.startsWith('/vouchers/journal')) {
      navigate('/vouchers/journal');
      return;
    }

    const mastersNew = path.match(/^\/masters\/([^/]+)\/new$/);
    if (mastersNew) {
      navigate(`/masters/${mastersNew[1]}`);
      return;
    }
    const mastersEdit = path.match(/^\/masters\/([^/]+)\/[^/]+\/edit$/);
    if (mastersEdit) {
      navigate(`/masters/${mastersEdit[1]}`);
      return;
    }

    if (path === '/parties/new') {
      navigate('/parties');
      return;
    }
    const partyEdit = path.match(/^\/parties\/([^/]+)$/);
    if (partyEdit && partyEdit[1] !== 'ledger-report' && partyEdit[1] !== 'new') {
      navigate('/parties');
      return;
    }

    if (
      path === '/schemes/new' ||
      path === '/schemes/retailer-dashboard' ||
      path === '/schemes/overdue-tracker' ||
      /^\/schemes\/[^/]+\/edit$/.test(path)
    ) {
      navigate('/schemes');
      return;
    }

    if (path === '/payments/new' || /^\/payments\/edit\/[^/]+$/.test(path) || path === '/payments/reports') {
      navigate('/payments');
      return;
    }

    if (path === '/gst/gstr1' || path === '/gst/gstr2' || path === '/gst/gstr3b' || path === '/gst/gstr9' || path === '/gst/hsn-summary') {
      navigate('/gst');
      return;
    }

    if (path === '/expenses/heads/new' || /^\/expenses\/heads\/edit\/[^/]+$/.test(path)) {
      navigate('/expenses');
      return;
    }

    navigate('/dashboard');
  }, [navigate, location.pathname]);

  /** Escape = same as header back (when no modal/menu is eating the key). */
  useEffect(() => {
    const isOpenBlockingDialog = () => {
      for (const node of document.querySelectorAll('[role="dialog"]')) {
        const el = node as HTMLElement;
        if (el.getAttribute('aria-hidden') === 'true') continue;
        const modal = el.closest('.MuiModal-root');
        if (modal?.classList.contains('MuiModal-open')) return true;
      }
      return false;
    };

    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const path = String(location.pathname ?? '').replace(/\/+$/, '') || '/';
      if (path === '/dashboard' || path === '/') return;

      const el = e.target as HTMLElement | null;
      if (el?.closest?.('[role="dialog"]')) return;
      if (el?.closest?.('[data-tally-picker-modal]')) return;
      if (el?.closest?.('.MuiPopover-root, .MuiMenu-root, .MuiAutocomplete-popper, [role="listbox"]')) return;
      if (isOpenBlockingDialog()) return;

      e.preventDefault();
      handleBackNavigation();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [location.pathname, handleBackNavigation]);

  /** F1 → About & Updates (when permitted), Tally-style help entry. */
  useEffect(() => {
    const onF1 = (e: KeyboardEvent) => {
      if (e.key !== 'F1') return;
      if (!canAccessFeature('manage-settings')) return;
      e.preventDefault();
      navigate({ pathname: '/settings', search: '?tab=about' });
    };
    window.addEventListener('keydown', onF1);
    return () => window.removeEventListener('keydown', onF1);
  }, [navigate, canAccessFeature]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const [headerSearch, setHeaderSearch] = useState('');

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
      navigate(`/masters/inventory-items?q=${encodeURIComponent(q)}`);
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
    navigate(`/masters/inventory-items?q=${encodeURIComponent(q)}`);
  };

  const titleBarOffset = electronUsesFramelessChrome() ? ELECTRON_TITLEBAR_HEIGHT_PX : 0;
  const TOOLBAR_ROW_XS = 56;
  const TOOLBAR_ROW_SM = 60;

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
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: 0, overflow: 'hidden' }}>
        <Box
          sx={(t) => ({
            position: 'fixed',
            top: titleBarOffset,
            left: 0,
            right: 0,
            zIndex: t.zIndex.drawer + 1,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 1px 0 rgba(15,23,42,0.12)',
            overflow: 'visible',
          })}
        >
          <DesktopErpTitleBar />
          <Box sx={{ display: { xs: 'none', sm: 'block' }, overflow: 'visible' }}>
            <DesktopErpMenuBar
              navigate={navigate}
              canAccessFeature={canAccessFeature}
              gstEnabled={gstEnabled}
            />
          </Box>
          <Toolbar
            disableGutters
            sx={{
              gap: 0,
              minHeight: { xs: TOOLBAR_ROW_XS, sm: TOOLBAR_ROW_SM },
              py: { xs: 0.25, sm: 0.35 },
              px: 0,
              bgcolor: '#E8EEF4',
              borderBottom: '1px solid #cbd5e1',
              color: ERP_TEXT,
            }}
          >
          <AppTopBar
            left={
              <>
                <IconButton
                  color="inherit"
                  aria-label="Open menu"
                  edge="start"
                  onClick={(e) => setMobileNavAnchor(e.currentTarget)}
                  sx={{ display: { sm: 'none' }, color: 'inherit' }}
                >
                  <MenuIcon />
                </IconButton>
                {showBackButton && (
                  <IconButton
                    color="inherit"
                    onClick={handleBackNavigation}
                    sx={{ color: 'inherit' }}
                    title="Go Back (Esc)"
                  >
                    <ArrowBackIcon />
                  </IconButton>
                )}
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
            center={
              shouldShowHeaderSearch ? (
                <TextField
                  size="small"
                  placeholder="Search items, invoices, purchases, customers…"
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitHeaderSearch();
                    }
                  }}
                  inputProps={{
                    'aria-label': 'Search inventory by name, SKU, or barcode',
                    title: 'Search by name, SKU, or barcode. Press Enter.',
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#64748b', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    width: '100%',
                    maxWidth: { xs: '100%', sm: 480, md: 560 },
                    '& .MuiOutlinedInput-root': {
                      height: 36,
                      bgcolor: '#fff',
                      borderRadius: 0,
                      color: ERP_TEXT,
                      fontSize: '0.8125rem',
                      '& fieldset': {
                        borderColor: '#94a3b8',
                      },
                      '&:hover fieldset': {
                        borderColor: ERP_TEXT,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: ERP_TEXT,
                      },
                    },
                    '& .MuiInputBase-input::placeholder': {
                      color: '#64748b',
                      opacity: 1,
                    },
                  }}
                />
              ) : (
                <Box sx={{ width: '100%', maxWidth: { xs: '100%', sm: 480, md: 560 }, height: 36 }} />
              )
            }
            right={
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 1,
                  border: '1px solid #cbd5e1',
                  bgcolor: '#fff',
                }}
              >
                <IconButton
                  color="inherit"
                  aria-label="Updates and notifications"
                  title="Check for updates"
                  onClick={(e) => setUpdateMenuAnchor(e.currentTarget)}
                  sx={{ color: 'inherit', p: 0.75 }}
                >
                  <Badge
                    color="warning"
                    variant="dot"
                    invisible={!updateCheck?.updateAvailable && !updateCheck?.belowMinimum}
                    overlap="circular"
                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    <NotificationsOutlinedIcon sx={{ fontSize: 22 }} />
                  </Badge>
                </IconButton>
                <Typography
                  variant="body2"
                  sx={{
                    maxWidth: 160,
                    display: { xs: 'none', md: 'block' },
                    color: 'inherit',
                    fontWeight: 600,
                  }}
                  noWrap
                  title={userFullName}
                >
                  {userFullName}
                </Typography>
                <IconButton
                  onClick={handleMenuOpen}
                  color="inherit"
                  sx={{ p: 0.25 }}
                >
                  <Avatar
                    src={userHasPhoto ? userPhotoUrl : undefined}
                    imgProps={{ referrerPolicy: 'no-referrer' }}
                    sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}
                  >
                    {userHasPhoto ? null : userInitials}
                  </Avatar>
                </IconButton>
              </Box>
            }
          />
          <Menu
            anchorEl={updateMenuAnchor}
            open={Boolean(updateMenuAnchor)}
            onClose={() => setUpdateMenuAnchor(null)}
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
            <MenuItem
              disabled={updateChecking}
              onClick={() => {
                void runManualUpdateCheck();
              }}
            >
              Check for updates
            </MenuItem>
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
            {updateCheck?.info?.downloadUrl ? (
              <MenuItem
                component="a"
                href={updateCheck.info.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setUpdateMenuAnchor(null)}
              >
                Open download page
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
        </Box>
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: ERP_WORKSPACE_BG,
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
            px: { xs: 1.25, sm: 2 },
            py: 1.25,
            color: ERP_TEXT,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': {
              width: 0,
              height: 0,
              display: 'none',
            },
          }}
        >
          <Box
            sx={{
              flexShrink: 0,
              height: `calc(${titleBarOffset}px + ${ERP_TITLE_ROW_PX}px + ${TOOLBAR_ROW_XS}px)`,
              '@media (min-width: 600px)': {
                height: `calc(${titleBarOffset}px + ${ERP_TITLE_ROW_PX}px + ${ERP_MENU_ROW_PX}px + ${TOOLBAR_ROW_SM}px)`,
              },
            }}
          />
        {appUpdate && (
          <Alert
            severity={appUpdate.info.mandatory ? 'warning' : 'info'}
            sx={{ mb: 2 }}
            action={
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Button
                  color="inherit"
                  size="small"
                  href={appUpdate.info.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
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
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </Box>
  );
};

export default Layout;
