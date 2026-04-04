// D:\PVEB\desktop\src\components\Layout.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme, alpha } from "@mui/material/styles";
import { Outlet, useNavigate, useLocation, To } from "react-router-dom";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Avatar,
  Collapse,
  Alert,
  Button,
  Stack,
  TextField,
  InputAdornment,
  Badge,
  CircularProgress,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import DashboardIcon from "@mui/icons-material/Dashboard";
import InventoryIcon from "@mui/icons-material/Inventory";
import PeopleIcon from "@mui/icons-material/People";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import BusinessIcon from "@mui/icons-material/Business";
import PersonIcon from "@mui/icons-material/Person";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import PaymentIcon from "@mui/icons-material/Payment";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import BarChartIcon from "@mui/icons-material/BarChart";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import FeedbackIcon from "@mui/icons-material/Feedback";

import { useAuth } from "../pages/contexts/auth";
import { useNavigationCustomization } from "../hooks/useNavigationCustomization";
import { usePermissions } from "../hooks/usePermissions";
import GstStampIcon from "./GstStampIcon";
import { getAppSettings } from '../services/appSettingsService';
import FeedbackDialog from "./FeedbackDialog";
import { checkForAppUpdate, type AppReleaseInfo } from "../services/appUpdateService";
import { isElectronRuntime } from "../utils/runtime";
import ElectronTitleBar, {
  ELECTRON_TITLEBAR_HEIGHT_PX,
  electronUsesFramelessChrome,
} from "./ElectronTitleBar";
import { appBarGradient, appBarForeground, appBarMutedForeground } from "../theme/shellChrome";

const drawerWidth = 240;

const getNavIconGradient = (key: string) => {
  const k = key.toLowerCase();
  if (k.includes('dashboard')) return 'linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)';
  if (k.includes('products') || k.includes('inventory')) return 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
  if (k.includes('parties') || k.includes('customers') || k.includes('suppliers') || k.includes('people'))
    return 'linear-gradient(135deg, #f97316 0%, #f43f5e 100%)';
  if (k.includes('transactions') || k.includes('invoices') || k.includes('receipt'))
    return 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)';
  if (k.includes('payments') || k.includes('payment')) return 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)';
  if (k.includes('accounts') || k.includes('account')) return 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)';
  if (k.includes('expenses')) return 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)';
  if (k.includes('gst')) return 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)';
  if (k.includes('schemes')) return 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)';
  if (k.includes('reports') || k.includes('assessment')) return 'linear-gradient(135deg, #06b6d4 0%, #22c55e 100%)';
  if (k.includes('settings')) return 'linear-gradient(135deg, #64748b 0%, #334155 100%)';
  return 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)';
};

const getNavIconBadgeSx = (options: { gradient: string; selected: boolean; size?: number }) => {
  const size = options.size ?? 34;
  const iconSize = Math.max(16, Math.round(size * 0.58));

  return {
    width: size,
    height: size,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Math.max(8, Math.round(size * 0.28)),
    background: options.gradient,
    border: '1px solid rgba(255,255,255,0.38)',
    position: 'relative',
    overflow: 'hidden',
    transform: options.selected ? 'translateY(-1px)' : 'translateY(0px)',
    boxShadow: options.selected
      ? '0 10px 18px rgba(0,0,0,0.28)'
      : '0 8px 14px rgba(0,0,0,0.18)',
    transition: 'transform 150ms ease, box-shadow 150ms ease, filter 150ms ease',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '48%',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.40), rgba(255,255,255,0.00))',
      zIndex: 0,
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -4px 10px rgba(0,0,0,0.28)',
      zIndex: 0,
    },
    '& svg': {
      position: 'relative',
      zIndex: 1,
      color: '#fff',
      fontSize: iconSize,
      filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.35))',
    },
  } as const;
};

const iconMap: Record<string, React.ComponentType<any>> = {
  Dashboard: DashboardIcon,
  Inventory: InventoryIcon,
  People: PeopleIcon,
  Person: PersonIcon,
  Business: BusinessIcon,
  Receipt: ReceiptIcon,
  ShoppingCart: ShoppingCartIcon,
  Payment: PaymentIcon,
  AccountBalance: AccountBalanceIcon,
  ReceiptLong: ReceiptLongIcon,
  Assessment: AssessmentIcon,
  AdminPanelSettings: AdminPanelSettingsIcon,
  Settings: SettingsIcon,
  Undo: UndoIcon,
  Redo: RedoIcon,
};

const getNavIconComponent = (idOrKey: string | undefined, fallbackIconKey: string | undefined) => {
  const id = String(idOrKey ?? '').toLowerCase();

  const byId: Record<string, React.ComponentType<any>> = {
    dashboard: DashboardIcon,
    products: InventoryIcon,

    parties: PeopleIcon,
    customers: PersonIcon,
    suppliers: BusinessIcon,
    'party-ledger-report': MenuBookIcon,

    transactions: ReceiptIcon,
    invoices: ReceiptIcon,
    'purchase-invoices': ShoppingCartIcon,
    'credit-notes': UndoIcon,
    'debit-notes': RedoIcon,
    godowns: InventoryIcon,

    vouchers: ReceiptLongIcon,
    'sales-vouchers': ReceiptIcon,
    'sales-return-vouchers': UndoIcon,
    'purchase-vouchers': ShoppingCartIcon,
    'purchase-return-vouchers': RedoIcon,
    'payment-vouchers': PaymentIcon,
    'receipt-vouchers': ReceiptIcon,
    'journal-vouchers': AccountBalanceIcon,

    payments: PaymentIcon,
    accounts: AccountBalanceIcon,
    gst: GstStampIcon,
    schemes: LocalOfferIcon,
    reports: BarChartIcon,
    settings: SettingsIcon,
  };

  const fromId = byId[id];
  if (fromId) return fromId;
  return iconMap[String(fallbackIconKey ?? '')] || SettingsIcon;
};

// Page title mapping
const getPageTitle = (pathname: string): { title: string; showBackButton: boolean } => {
  const routeMap: Record<string, { title: string; showBackButton: boolean }> = {
    '/dashboard': { title: 'Dashboard', showBackButton: false },
    '/products': { title: 'Products', showBackButton: false },
    '/products/new': { title: 'New Product', showBackButton: true },
    '/products/edit': { title: 'Edit Product', showBackButton: true },
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
    '/vouchers/sales': { title: 'Sales Vouchers', showBackButton: false },
    '/vouchers/sales/new': { title: 'New Sales Voucher', showBackButton: true },
    '/vouchers/sales/new-staged': { title: 'Guided Sales Invoice', showBackButton: true },
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
  };

  const isNewOrEdit = pathname.includes('/new') || pathname.includes('/edit');

  // Find exact match first
  if (routeMap[pathname]) {
    return routeMap[pathname];
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
    return { title: 'Products', showBackButton: isNewOrEdit };
  }

  return { title: 'InvoicePro', showBackButton: false };
};

function readCompanyOwnerName(): string {
  try {
    const raw = localStorage.getItem("company-info");
    if (!raw) return "";
    const p = JSON.parse(raw) as { name?: string };
    return String(p?.name ?? "").trim();
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
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
  const { getEnabledMenuItems } = useNavigationCustomization();
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
  const enabledMenuItems = getEnabledMenuItems();

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

  const isFeatureEnabled = (menuId: string) => {
    const id = String(menuId ?? '').toLowerCase();
    if (id === 'gst') return Boolean(appSettings?.features?.gstEnabled);
    return true;
  };

  const hasMenuPermission = (menuId: string) => {
    const id = String(menuId ?? '').toLowerCase();

    const permissionMap: Record<string, string> = {
      dashboard: 'dashboard',
      products: 'view-products',

      'party-ledger-report': 'view-reports',

      invoices: 'view-invoices',
      'purchase-invoices': 'view-invoices',
      'credit-notes': 'view-invoices',
      'debit-notes': 'view-invoices',

      payments: 'view-payments',
      accounts: 'view-bank',
      reports: 'view-reports',
      gst: 'view-gst',

      settings: 'manage-settings',
    };

    const required = permissionMap[id];
    if (!required) return true;
    try {
      return canAccessFeature(required);
    } catch {
      return false;
    }
  };

  const filteredMenuItems = enabledMenuItems
    .map((item: any) => {
      if (item && 'items' in item && Array.isArray(item.items)) {
        const nextItems = item.items
          .filter((sub: any) => hasMenuPermission(String(sub?.id ?? '')))
          .filter((sub: any) => isFeatureEnabled(String(sub?.id ?? '')));
        return { ...item, items: nextItems };
      }
      return item;
    })
    .filter((item: any) => {
      if (item && 'items' in item && Array.isArray(item.items)) {
        return item.items.length > 0;
      }
      return hasMenuPermission(String(item?.id ?? '')) && isFeatureEnabled(String(item?.id ?? ''));
    });

  const handleBackNavigation = () => {
    const path = String(location.pathname ?? '');
    if (path.startsWith('/customers/ledger') || path.startsWith('/suppliers/ledger')) {
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
    navigate(-1);
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Load expanded groups from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_expanded_groups');
      if (saved) {
        const parsed = JSON.parse(saved);
        setExpandedGroups(new Set(parsed));
      }
    } catch (error) {
      console.warn('Failed to load sidebar expansion state:', error);
    }
  }, []);

  // Save expanded groups to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('sidebar_expanded_groups', JSON.stringify(Array.from(expandedGroups)));
    } catch (error) {
      console.warn('Failed to save sidebar expansion state:', error);
    }
  }, [expandedGroups]);

  /** Accounts + Vouchers: only one expanded at a time (accordion). */
  const ACCORDION_GROUPS = new Set<string>(['accounts', 'vouchers']);

  const handleGroupToggle = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      if (ACCORDION_GROUPS.has(groupId)) {
        ACCORDION_GROUPS.forEach((id) => {
          if (id !== groupId) newExpanded.delete(id);
        });
      }
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const getCompanyName = () =>
    localStorage.getItem('companyName')?.trim() || 'GST Billing Software';
  const [companyName, setCompanyName] = useState<string>(getCompanyName());

  const getCompanyLogo = () => {
    const direct = localStorage.getItem('companyLogo')?.trim();
    if (direct) return direct;
    try {
      const raw = localStorage.getItem('company-info');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return String(parsed?.logo ?? '').trim();
    } catch {
      return '';
    }
  };
  const [companyLogo, setCompanyLogo] = useState<string>(getCompanyLogo());
  const [headerSearch, setHeaderSearch] = useState('');

  const headerDateLine = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date()),
    []
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'companyName') setCompanyName(getCompanyName());
      if (e.key === 'companyLogo' || e.key === 'company-info') setCompanyLogo(getCompanyLogo());
    };
    const onCustom = () => {
      setCompanyName(getCompanyName());
      setCompanyLogo(getCompanyLogo());
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('companyProfileUpdated', onCustom as any);
    window.addEventListener('companyNameUpdated', onCustom as any); // Keep for backward compatibility
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('companyProfileUpdated', onCustom as any);
      window.removeEventListener('companyNameUpdated', onCustom as any);
    };
  }, []);

  const handleLogout = () => {
    // AuthContext se logout
    logout();
    handleMenuClose();
    // turant login page par redirect
    navigate("/login");
  };

  const theme = useTheme();
  const navItemSelectedSx = useMemo(
    () => ({
      "&.Mui-selected": {
        bgcolor: theme.palette.mode === "dark" ? alpha(theme.palette.primary.main, 0.22) : "#ffffff",
        boxShadow: theme.palette.mode === "dark" ? "none" : "0 1px 3px 0 rgb(0 0 0 / 0.1)",
        "&:hover": {
          bgcolor: theme.palette.mode === "dark" ? alpha(theme.palette.primary.main, 0.3) : "#f1f5f9",
        },
      },
    }),
    [theme]
  );

  const drawer = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.sidebar",
        borderRight: { sm: "1px solid" },
        borderColor: "divider",
      }}
    >
      <Box sx={{ flex: '1 1 auto', overflowY: 'auto', px: 2, pb: 2, pt: 2 }}>
        <List sx={{ gap: 0.5, display: 'flex', flexDirection: 'column' }}>
        {filteredMenuItems
          .filter((item) => {
            // Only restrict access to sensitive features, allow everything else
            const restrictedFeatures: Record<string, string> = {
              'user-management': 'manage-users',
              'settings': 'manage-settings',
            };

            // Check if this is a restricted feature
            const requiredPermission = restrictedFeatures[item.id];
            if (requiredPermission) {
              try {
                return canAccessFeature(requiredPermission);
              } catch (error) {
                // If permission check fails (e.g., no user logged in), hide restricted features
                return false;
              }
            }

            // For menu groups, always show them (sub-items will be filtered individually if needed)
            if ('items' in item) {
              return true;
            }

            // Allow all other menu items by default
            return true;
          })
          .map((item) => {
            // Check if it's a group
            if ('items' in item) {
              // It's a MenuGroup - sidebar collapsible groups (parties, transactions)
              const IconComponent = getNavIconComponent(item.id, item.icon);
              const isExpanded = expandedGroups.has(item.id);
              const isGroupSelected = item.items.some(
                (sub: { path: string; }) => location.pathname === sub.path || location.pathname.startsWith(sub.path + '/')
              );
              const groupGradient = getNavIconGradient(String(item.id ?? item.icon ?? ''));

              return (
                <React.Fragment key={item.id}>
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton 
                      onClick={() => handleGroupToggle(item.id)}
                      sx={{ 
                        borderRadius: 2,
                        ...navItemSelectedSx,
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 48 }}>
                        <Box
                          sx={{
                            ...getNavIconBadgeSx({ gradient: groupGradient, selected: isGroupSelected }),
                            ...(isExpanded
                              ? { filter: 'saturate(1.15) brightness(1.05)' }
                              : undefined),
                            '.MuiListItemButton-root:hover &': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 12px 18px rgba(0,0,0,0.26)',
                            },
                          }}
                        >
                          <IconComponent />
                        </Box>
                      </ListItemIcon>
                      <ListItemText 
                        primary={item.text} 
                        primaryTypographyProps={{ 
                          fontWeight: isGroupSelected ? 700 : 600,
                          fontSize: '0.9rem' 
                        }} 
                      />
                      {isExpanded ? <ExpandLessIcon sx={{ fontSize: '1.2rem', opacity: 0.5 }} /> : <ExpandMoreIcon sx={{ fontSize: '1.2rem', opacity: 0.5 }} />}
                    </ListItemButton>
                  </ListItem>
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding sx={{ pl: 1 }}>
                      {item.items.map((subItem: any) => {
                        const SubIconComponent = getNavIconComponent(String(subItem.id ?? ''), subItem.icon);
                        const isSubSelected =
                          location.pathname === subItem.path ||
                          location.pathname.startsWith(subItem.path + '/');
                        const subGradient = getNavIconGradient(String(subItem.id ?? subItem.icon ?? ''));
                        return (
                          <ListItem key={subItem.id} disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                              selected={isSubSelected}
                              onClick={() => navigate(subItem.path)}
                              sx={{ 
                                borderRadius: 2,
                                pl: 2,
                                ...navItemSelectedSx,
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 44 }}>
                                <Box
                                  sx={{
                                    ...getNavIconBadgeSx({
                                      gradient: subGradient,
                                      selected: isSubSelected,
                                      size: 28,
                                    }),
                                  }}
                                >
                                  <SubIconComponent />
                                </Box>
                              </ListItemIcon>
                              <ListItemText 
                                primary={subItem.text} 
                                primaryTypographyProps={{ 
                                  fontWeight: isSubSelected ? 700 : 500,
                                  fontSize: '0.85rem' 
                                }} 
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Collapse>
                </React.Fragment>
              );
            } else {
              // It's a MenuItem
          const IconComponent = getNavIconComponent(item.id, item.icon);
          const isSelected = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const gradient = getNavIconGradient(item.id || item.icon);
          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => navigate(item.path)}
                sx={{ 
                  borderRadius: 2,
                  ...navItemSelectedSx,
                }}
              >
                <ListItemIcon sx={{ minWidth: 48 }}>
                  <Box
                    sx={{
                      ...getNavIconBadgeSx({ gradient, selected: isSelected }),
                      '.MuiListItemButton-root:hover &': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 18px rgba(0,0,0,0.26)',
                      },
                    }}
                  >
                    <IconComponent />
                  </Box>
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{ 
                    fontWeight: isSelected ? 700 : 600,
                    fontSize: '0.9rem' 
                  }} 
                />
              </ListItemButton>
            </ListItem>
          );
            }
        })}
        </List>
      </Box>
    </Box>
  );

  const submitHeaderSearch = () => {
    const q = headerSearch.trim();
    navigate(
      q
        ? `/masters/inventory-items?q=${encodeURIComponent(q)}`
        : '/masters/inventory-items'
    );
  };

  const titleBarOffset = electronUsesFramelessChrome() ? ELECTRON_TITLEBAR_HEIGHT_PX : 0;
  /** Single full-width AppBar sits below title bar; drawer nav starts under it */
  const drawerPaperTopSx =
    titleBarOffset > 0
      ? {
          top: `${titleBarOffset + 56}px`,
          height: `calc(100% - ${titleBarOffset + 56}px)`,
          '@media (min-width: 600px)': {
            top: `${titleBarOffset + 64}px`,
            height: `calc(100% - ${titleBarOffset + 64}px)`,
          },
        }
      : {
          top: '56px',
          height: 'calc(100% - 56px)',
          '@media (min-width: 600px)': {
            top: '64px',
            height: 'calc(100% - 64px)',
          },
        };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100vh' }}>
      <ElectronTitleBar />
      <Box sx={{ display: 'flex', flex: 1, width: '100%', minHeight: 0 }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={(t) => ({
          top: titleBarOffset,
          left: 0,
          right: 0,
          width: '100%',
          ml: 0,
          zIndex: t.zIndex.drawer + 1,
          background: appBarGradient(t),
          borderBottom: `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 0,
          boxShadow: t.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.22)' : '0 2px 12px rgba(0,0,0,0.08)',
          color: appBarForeground(t),
        })}
      >
        <Toolbar
          disableGutters
          sx={{
            gap: 0,
            minHeight: { xs: 56, sm: 64 },
            py: { xs: 0.5, sm: 0.75 },
            px: 0,
            color: appBarForeground(theme),
          }}
        >
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              width: drawerWidth,
              flexShrink: 0,
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              boxSizing: 'border-box',
              borderRight: (t) =>
                `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)'}`,
              alignSelf: 'stretch',
              minHeight: { sm: 64 },
            }}
          >
            {companyLogo ? (
              <Box
                component="img"
                src={companyLogo}
                alt=""
                sx={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 1 }}
              />
            ) : (
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: (t) =>
                    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : alpha(t.palette.primary.main, 0.2),
                  fontWeight: 800,
                  color: 'inherit',
                }}
              >
                {companyName.charAt(0)}
              </Avatar>
            )}
            <Typography
              variant="subtitle1"
              noWrap
              sx={{
                fontWeight: 800,
                color: 'inherit',
                fontSize: '0.95rem',
                letterSpacing: '-0.02em',
              }}
              title={companyName}
            >
              {companyName}
            </Typography>
          </Box>

          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ ml: 1, display: { sm: 'none' }, color: 'inherit' }}
          >
            <MenuIcon />
          </IconButton>
          <Box
            sx={{
              display: { xs: 'flex', sm: 'none' },
              alignItems: 'center',
              gap: 1,
              minWidth: 0,
              maxWidth: '42vw',
            }}
          >
            {companyLogo ? (
              <Box
                component="img"
                src={companyLogo}
                alt=""
                sx={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0, borderRadius: 0.5 }}
              />
            ) : (
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  bgcolor: (t) =>
                    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : alpha(t.palette.primary.main, 0.2),
                  fontSize: '0.75rem',
                  color: 'inherit',
                }}
              >
                {companyName.charAt(0)}
              </Avatar>
            )}
            <Typography variant="body2" noWrap fontWeight={700} color="inherit" title={companyName}>
              {companyName}
            </Typography>
          </Box>

          {showBackButton && (
            <IconButton
              color="inherit"
              onClick={handleBackNavigation}
              sx={{ ml: { xs: 0.5, sm: 0 }, mr: 0.5, color: 'inherit' }}
              title="Go Back"
            >
              <ArrowBackIcon />
            </IconButton>
          )}

          <Box
            sx={{
              minWidth: 0,
              flex: { xs: '0 1 auto', md: '0 1 160px' },
              maxWidth: { md: 'min(220px, 28vw)' },
              mr: { md: 1 },
              ml: { xs: 0.5, sm: 1.5 },
            }}
          >
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'inherit',
                fontSize: { xs: '1rem', sm: '1.15rem' },
                lineHeight: 1.25,
              }}
            >
              {pageTitle}
            </Typography>
            <Typography
              variant="caption"
              noWrap
              sx={{
                display: { xs: 'none', sm: 'block' },
                color: appBarMutedForeground(theme),
                fontSize: '0.72rem',
                mt: 0.25,
              }}
              title={headerDateLine}
            >
              {headerDateLine}
            </Typography>
          </Box>

          <TextField
            size="small"
            placeholder="Search items…"
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
                  <SearchIcon sx={{ color: appBarMutedForeground(theme), fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: 1,
              minWidth: { sm: 200, md: 260 },
              maxWidth: { xs: 160, sm: 440, md: 560 },
              display: { xs: 'none', sm: 'block' },
              '& .MuiOutlinedInput-root': {
                bgcolor: (t) =>
                  t.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.28)',
                borderRadius: 2,
                color: 'inherit',
                fontSize: '0.8125rem',
                '& fieldset': {
                  borderColor: (t) =>
                    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.45)',
                },
                '&:hover fieldset': {
                  borderColor: (t) =>
                    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.65)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: (t) => alpha(t.palette.primary.light, 0.9),
                },
              },
              '& .MuiInputBase-input::placeholder': {
                color: appBarMutedForeground(theme),
                opacity: 1,
              },
            }}
          />

          <IconButton
            color="inherit"
            aria-label="Updates and notifications"
            title="Check for updates"
            onClick={(e) => setUpdateMenuAnchor(e.currentTarget)}
            sx={{ color: 'inherit' }}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                maxWidth: 200,
                display: { xs: 'none', md: 'block' },
                color: 'inherit',
                fontWeight: 500,
              }}
              noWrap
              title={userFullName}
            >
              {userFullName}
            </Typography>
            <IconButton
              onClick={handleMenuOpen}
              color="inherit"
              sx={{
                p: 0.5,
                border: (t) =>
                  `1px solid ${
                    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)'
                  }`,
                '&:hover': {
                  bgcolor: (t) =>
                    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                },
              }}
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
            {hasMenuPermission('settings') ? (
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
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              ...drawerPaperTopSx,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              ...drawerPaperTopSx,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          bgcolor: "background.content",
        }}
      >
        <Toolbar
          sx={{
            minHeight: `${titleBarOffset + 56}px !important`,
            '@media (min-width: 600px)': {
              minHeight: `${titleBarOffset + 64}px !important`,
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
      </Box>
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </Box>
  );
};

export default Layout;
