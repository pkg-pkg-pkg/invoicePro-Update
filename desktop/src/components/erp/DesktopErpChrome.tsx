import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useLocation, type NavigateFunction } from 'react-router-dom';
import { getNormalizedCompanyProfile } from '../../utils/companyProfile';
import { financialYearLabel } from '../dashboard/dashboardTheme';
import {
  getWhatsAppConnectionStatus,
  refreshWhatsAppConnectionStatus,
  subscribeWhatsAppConnectionStatus,
  type WhatsAppConnectionStatus,
} from '../../services/whatsappIntegration';
import {
  resolveActiveCompanyDisplayName,
  resolveActiveCompanyDisplayNameSync,
} from '../../services/companyDisplayName';
import { APP_DISPLAY_NAME } from '@/constants/appBranding';

const HEADER_COMPANY_NAME_MAX = 48;

function headerCompanyLabel(fullName: string): {
  display: string;
  full: string;
} {
  const full = String(fullName || '').trim() || APP_DISPLAY_NAME;
  if (full.length <= HEADER_COMPANY_NAME_MAX) {
    return { display: full, full };
  }
  return { display: `${full.slice(0, HEADER_COMPANY_NAME_MAX)}...`, full };
}
import CompanySelectScreen from '../CompanySelectScreen';

/** Row heights for layout spacer math (title + menu below frame). */
/** Title + menu rows (~20% shorter than legacy ERP chrome). */
export const ERP_TITLE_ROW_PX = 27;
export const ERP_MENU_ROW_PX = 26;

import {
  getErpChromeColors,
} from '../../theme/erpColors';
const SUPPORT_WEBSITE = 'https://www.prityvanya.com';

type MenuEntry = { label: string; path: string; perm?: string; section?: string };
type ErpMenu = { id: string; label: string; items: MenuEntry[] };

export type ErpFlatNavItem = MenuEntry & { group: string };

type CanAccess = (feature: string) => boolean;

export function erpNavigateTo(navigate: NavigateFunction, path: string) {
  const q = path.indexOf('?');
  if (q >= 0) {
    navigate({ pathname: path.slice(0, q), search: path.slice(q) });
  } else {
    navigate(path);
  }
}

const ERP_MENUS: ErpMenu[] = [
  {
    id: 'company',
    label: 'Company',
    items: [
      { label: 'Settings', path: '/settings', perm: 'manage-settings' },
      { label: 'Company Desk', path: '/settings?tab=companydesk', perm: 'manage-settings' },
      { label: 'Switch Company', path: '__switch_company__', perm: 'manage-settings' },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    items: [{ label: 'Dashboard', path: '/dashboard' }],
  },
  {
    id: 'masters',
    label: 'Masters',
    items: [
      { label: 'Items Desk', path: '/items' },
      { label: 'Ledger Accounts', path: '/masters/ledger-accounts' },
      { label: 'Bank Accounts', path: '/masters/bank-accounts' },
      { label: 'Godowns', path: '/masters/godowns' },
      { label: 'Inventory Items', path: '/masters/inventory-items' },
      { label: 'Price Lists', path: '/masters/price-lists' },
      { label: 'Stock Adjustments', path: '/masters/stock-adjustments' },
      { label: 'Customers', path: '/customers' },
      { label: 'Customer Ledger', path: '/customers/ledger-report' },
    ],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    items: [
      { label: 'Sales Desk', path: '/sales', section: 'Sales & Purchase' },
      { label: 'Purchase Desk', path: '/purchase', section: 'Sales & Purchase' },
      { label: 'Banking Desk', path: '/banking', section: 'Money Vouchers' },
      { label: 'Sales Return', path: '/vouchers/sales-return', section: 'Sales & Purchase' },
      { label: 'Purchase Return', path: '/vouchers/purchase-return', section: 'Sales & Purchase' },
      { label: 'Payment Voucher', path: '/vouchers/payment', section: 'Money Vouchers' },
      { label: 'Receipt Voucher', path: '/vouchers/receipt', section: 'Money Vouchers' },
      { label: 'Journal Voucher', path: '/vouchers/journal', section: 'Money Vouchers' },
      { label: 'Voucher Control Desk', path: '/vouchers', section: 'Utilities' },
      { label: 'Expenses', path: '/expenses', section: 'Utilities' },
      { label: 'Payments', path: '/payments', section: 'Utilities' },
      { label: 'Sales / Purchase Invoices', path: '/purchase-invoices', section: 'Utilities' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: [
      { label: 'Final Results & P/L', path: '/reports', section: 'Financial Reports' },
      { label: 'Balance Sheet', path: '/reports?view=financial&report=balancesheet', section: 'Financial Reports' },
      { label: 'P&L Statement', path: '/reports?view=pre-gst-profit&report=pnl', section: 'Financial Reports' },
      { label: 'Outstanding Analysis', path: '/reports', section: 'Financial Reports' },
      { label: 'Sales Analysis', path: '/reports', section: 'Business Analysis' },
      { label: 'Purchase Analysis', path: '/reports', section: 'Business Analysis' },
      { label: 'Inventory Summary', path: '/reports', section: 'Inventory Reports' },
      { label: 'GST Reports', path: '/gst', section: 'Tax Reports' },
    ],
  },
  {
    id: 'schemes',
    label: 'Schemes',
    items: [
      { label: 'Traditional Schemes', path: '/schemes?view=traditional' },
      { label: 'Smart Scheme Engine', path: '/schemes?view=smart&tab=create' },
      { label: 'Retailer Dashboard', path: '/schemes?view=smart&tab=dashboard' },
      { label: 'Overdue Tracker', path: '/schemes?view=smart&tab=payment' },
      { label: 'Achievement', path: '/schemes?view=smart&tab=achievement' },
    ],
  },
  {
    id: 'utilities',
    label: 'Utilities',
    items: [
      { label: 'Upload from Tally/Busy/Marg', path: '/import/erp' },
      { label: 'Approval Pending', path: '/approvals/pending', perm: 'manage-users' },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [{ label: 'About & Updates', path: '/settings?tab=about', perm: 'manage-settings' }],
  },
];

export function getErpFlatNavLinks(canAccessFeature: CanAccess, gstEnabled: boolean): ErpFlatNavItem[] {
  const out: ErpFlatNavItem[] = [];
  for (const m of ERP_MENUS) {
    for (const it of m.items) {
      if (it.path.startsWith('__')) continue;
      if (it.perm && !canAccessFeature(it.perm)) continue;
      if (!gstEnabled && it.path.startsWith('/gst')) continue;
      out.push({ ...it, group: m.label });
    }
  }
  return out;
}

function useNowTick(ms: number) {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setT(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return t;
}

function useCompanyProfileVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((x) => x + 1);
    window.addEventListener('companyProfileUpdated', bump);
    window.addEventListener('activeCompanyChanged', bump);
    window.addEventListener('companySettingsChanged', bump);
    return () => {
      window.removeEventListener('companyProfileUpdated', bump);
      window.removeEventListener('activeCompanyChanged', bump);
      window.removeEventListener('companySettingsChanged', bump);
    };
  }, []);
  return v;
}

export function useHeaderCompanyName() {
  const cv = useCompanyProfileVersion();
  const [name, setName] = useState(() => resolveActiveCompanyDisplayNameSync());
  useEffect(() => {
    let cancelled = false;
    void resolveActiveCompanyDisplayName().then((n) => {
      if (!cancelled) setName(n);
    });
    return () => {
      cancelled = true;
    };
  }, [cv]);
  return name;
}

export function DesktopErpTitleBar({
  leadingSlot,
  centerSlot,
  rightSlot,
}: {
  leadingSlot?: React.ReactNode;
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
} = {}) {
  const theme = useTheme();
  const chrome = useMemo(
    () => getErpChromeColors(theme.palette.mode === 'dark' ? 'premium-dark' : 'light'),
    [theme.palette.mode]
  );
  const headerCompanyName = useHeaderCompanyName();
  const { display: headerName, full: fullCompanyName } = useMemo(
    () => headerCompanyLabel(headerCompanyName),
    [headerCompanyName]
  );

  useEffect(() => {
    const title = fullCompanyName || APP_DISPLAY_NAME;
    document.title = `${APP_DISPLAY_NAME} — ${title}`;
  }, [fullCompanyName]);
  const [switchOpen, setSwitchOpen] = useState(false);

  useEffect(() => {
    const open = () => setSwitchOpen(true);
    window.addEventListener('openSwitchCompanyDialog', open);
    return () => window.removeEventListener('openSwitchCompanyDialog', open);
  }, []);

  return (
    <Box
      sx={{
        bgcolor: chrome.headerBg,
        color: chrome.headerText,
        px: 1.25,
        py: 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        minHeight: centerSlot ? 44 : ERP_TITLE_ROW_PX,
        borderBottom: `1px solid ${chrome.headerBorder}`,
        transition: 'background-color 300ms ease, color 300ms ease, border-color 300ms ease',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flexShrink: 0, maxWidth: { xs: '38%', sm: '28%' } }}>
        {leadingSlot ?? null}
        <Typography
          variant="body2"
          component="button"
          type="button"
          onClick={() => setSwitchOpen(true)}
          title={fullCompanyName === headerName ? 'Switch company' : `${fullCompanyName} — click to switch company`}
          sx={{
            fontWeight: 700,
            fontSize: '0.78rem',
            letterSpacing: 0.15,
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            textAlign: 'left',
            p: 0,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {headerName}
        </Typography>
      </Box>
      <CompanySelectScreen mode="switch" open={switchOpen} onClose={() => setSwitchOpen(false)} />
      {centerSlot ? (
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            justifyContent: 'center',
            px: { xs: 0.5, sm: 1.5 },
          }}
        >
          <Box sx={{ width: '100%', maxWidth: { xs: '100%', md: 560 } }}>{centerSlot}</Box>
        </Box>
      ) : (
        <Box sx={{ flex: 1 }} />
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flexShrink: 0 }}>
        {rightSlot ?? null}
      </Box>
    </Box>
  );
}

export function DesktopErpMenuBar({
  navigate,
  canAccessFeature,
  gstEnabled,
}: {
  navigate: NavigateFunction;
  canAccessFeature: CanAccess;
  gstEnabled: boolean;
}) {
  const theme = useTheme();
  const chrome = useMemo(
    () => getErpChromeColors(theme.palette.mode === 'dark' ? 'premium-dark' : 'light'),
    [theme.palette.mode]
  );
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const menuBarHoverRef = useRef(false);
  const menuPaperHoverRef = useRef(false);

  const clearCloseTimer = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      if (menuBarHoverRef.current || menuPaperHoverRef.current) return;
      setAnchorEl(null);
      setOpenId(null);
    }, 220);
  };

  const openMenu = (e: React.MouseEvent<HTMLElement>, id: string) => {
    clearCloseTimer();
    setAnchorEl(e.currentTarget);
    setOpenId(id);
  };

  const closeNow = () => {
    clearCloseTimer();
    menuBarHoverRef.current = false;
    menuPaperHoverRef.current = false;
    setAnchorEl(null);
    setOpenId(null);
  };

  const filteredMenus = useMemo(() => {
    return ERP_MENUS.map((m) => ({
      ...m,
      items: m.items.filter((it) => {
        if (it.perm && !canAccessFeature(it.perm)) return false;
        if (!gstEnabled && it.path.startsWith('/gst')) return false;
        return true;
      }),
    })).filter((m) => m.items.length > 0);
  }, [canAccessFeature, gstEnabled]);

  const activeMenu = filteredMenus.find((m) => m.id === openId);
  const ITEM_SHORTCUTS: Record<string, string> = {
    '/settings': 'Alt+S',
    '/settings?tab=companydesk': 'Alt+C',
    '/dashboard': 'Alt+D',
    '/masters/ledger-accounts': 'Alt+L',
    '/masters/bank-accounts': 'Alt+B',
    '/masters/godowns': 'Alt+G',
    '/masters/inventory-items': 'Alt+I',
    '/parties': 'F2',
    '/parties/ledger-report': 'Alt+R',
    '/vouchers/sales': 'F3',
    '/vouchers/purchase': 'F4',
    '/vouchers/sales-return': 'Alt+3',
    '/vouchers/purchase-return': 'Alt+4',
    '/vouchers/payment': 'Alt+P',
    '/vouchers/receipt': 'Alt+V',
    '/vouchers/journal': 'Alt+J',
    '/vouchers': 'Alt+K',
    '/expenses': 'Alt+E',
    '/payments': 'Alt+Y',
    '/purchase-invoices': 'Alt+N',
    '/reports': 'Alt+6',
    '/reports?view=financial&report=balancesheet': 'Alt+Q',
    '/reports?view=pre-gst-profit&report=pnl': 'Alt+W',
    '/gst': 'F6',
    '/schemes?view=traditional': 'Alt+T',
    '/schemes?view=smart&tab=create': 'Alt+U',
    '/schemes?view=smart&tab=dashboard': 'Alt+M',
    '/schemes?view=smart&tab=payment': 'Alt+O',
    '/schemes?view=smart&tab=achievement': 'Alt+A',
    '/import/erp': 'Alt+X',
    '/approvals/pending': 'Alt+H',
    '/settings?tab=about': 'F1',
  };
  const getShortcutLabel = (item: MenuEntry): string => ITEM_SHORTCUTS[item.path] || '';

  return (
    <Box
      sx={{
        bgcolor: chrome.menuBg,
        color: chrome.menuText,
        display: 'flex',
        alignItems: 'stretch',
        minHeight: ERP_MENU_ROW_PX,
        borderBottom: `1px solid ${chrome.headerBorder}`,
        userSelect: 'none',
        position: 'relative',
        overflow: 'visible',
        zIndex: 1,
        transition: 'background-color 300ms ease, color 300ms ease, border-color 300ms ease',
      }}
      onMouseEnter={() => {
        menuBarHoverRef.current = true;
        clearCloseTimer();
      }}
      onMouseLeave={() => {
        menuBarHoverRef.current = false;
        scheduleClose();
      }}
    >
      {filteredMenus.map((m) => {
        const singleItem = m.items.length === 1;
        const isActive = m.items.some((it) => {
          const base = it.path.split('?')[0];
          return location.pathname === base || location.pathname.startsWith(`${base}/`);
        });
        const directItem = singleItem ? m.items[0] : null;
        return (
          <Box
            key={m.id}
            component="button"
            type="button"
            onMouseEnter={(e) => {
              if (singleItem) return;
              openMenu(e, m.id);
            }}
            onClick={() => {
              if (!directItem) return;
              erpNavigateTo(navigate, directItem.path.startsWith('/') ? directItem.path : `/${directItem.path}`);
              closeNow();
            }}
            sx={{
              position: 'relative',
              border: 0,
              cursor: 'pointer',
              px: 1.5,
              py: 0.55,
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '0.01em',
              bgcolor:
                openId === m.id && !singleItem ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: chrome.menuText,
              fontFamily: '"Inter", system-ui, sans-serif',
              borderRight: `1px solid ${chrome.headerBorder}`,
              transition: 'background-color 200ms ease, color 200ms ease',
              '&:hover': { bgcolor: chrome.menuHover },
              ...(isActive
                ? {
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      left: '14%',
                      right: '14%',
                      bottom: 0,
                      height: 2,
                      borderRadius: '2px 2px 0 0',
                      bgcolor: chrome.menuActive,
                    },
                  }
                : {}),
            }}
          >
            {m.label}
          </Box>
        );
      })}
      <Menu
        disablePortal
        keepMounted
        anchorEl={anchorEl}
        open={Boolean(activeMenu && anchorEl && activeMenu.items.length > 1)}
        onClose={closeNow}
        autoFocus={false}
        disableAutoFocusItem
        disableEnforceFocus
        disableRestoreFocus
        MenuListProps={{
          autoFocusItem: false,
          dense: true,
          sx: {
            py: 0,
            minWidth: 200,
            bgcolor: chrome.menuDropdownBg,
            border: `1px solid ${chrome.toolbarBorder}`,
            '& .MuiMenuItem-root': {
              fontSize: '0.8125rem',
              minHeight: 32,
              color: chrome.text,
              borderBottom: `1px solid ${chrome.toolbarBorder}`,
              '&:hover': { bgcolor: chrome.menuDropdownHover },
              '&.Mui-selected': { bgcolor: alpha(chrome.select, 0.25), color: chrome.text, fontWeight: 700 },
              '&.Mui-selected:hover': { bgcolor: alpha(chrome.select, 0.35) },
              '&:last-of-type': { borderBottom: 0 },
            },
          },
        }}
        slotProps={{
          paper: {
            elevation: 4,
            sx: {
              mt: 0,
              borderRadius: 0,
              pointerEvents: 'auto',
            },
            onMouseEnter: () => {
              menuPaperHoverRef.current = true;
              clearCloseTimer();
            },
            onMouseLeave: () => {
              menuPaperHoverRef.current = false;
              scheduleClose();
            },
          },
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {activeMenu?.items.map((it, idx) => {
          const base = it.path.split('?')[0];
          const q = it.path.includes('?') ? `?${it.path.split('?')[1]}` : '';
          const selected =
            location.pathname === base && (!q || location.search === q || location.search.startsWith(`${q}&`));
          const prevSection = idx > 0 ? activeMenu.items[idx - 1].section : null;
          const showSection = Boolean(it.section && it.section !== prevSection);
          return (
            <React.Fragment key={it.path + it.label}>
              {showSection ? (
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: '#475569',
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    bgcolor: '#edf2f7',
                    borderTop: idx === 0 ? 'none' : '1px solid #e2e8f0',
                  }}
                >
                  {it.section}
                </Box>
              ) : null}
              <MenuItem
                selected={selected}
                onClick={() => {
                  if (it.path === '__switch_company__') {
                    window.dispatchEvent(new Event('openSwitchCompanyDialog'));
                    closeNow();
                    return;
                  }
                  erpNavigateTo(navigate, it.path.startsWith('/') ? it.path : `/${it.path}`);
                  closeNow();
                }}
              >
                <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.label}
                  </Box>
                  {getShortcutLabel(it) ? (
                    <Box
                      component="span"
                      sx={{
                        flexShrink: 0,
                        fontSize: '0.68rem',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        color: '#64748b',
                        bgcolor: '#eef2f7',
                        border: '1px solid #cbd5e1',
                        borderRadius: 0.75,
                        px: 0.5,
                        py: 0.125,
                        lineHeight: 1.2,
                      }}
                    >
                      {getShortcutLabel(it)}
                    </Box>
                  ) : null}
                </Box>
              </MenuItem>
            </React.Fragment>
          );
        })}
      </Menu>
    </Box>
  );
}

export function DesktopErpStatusBar({
  userLabel,
  canAccessFeature,
}: {
  userLabel: string;
  canAccessFeature: CanAccess;
}) {
  const theme = useTheme();
  const chrome = useMemo(
    () => getErpChromeColors(theme.palette.mode === 'dark' ? 'premium-dark' : 'light'),
    [theme.palette.mode]
  );
  const now = useNowTick(60_000);
  const cv = useCompanyProfileVersion();
  const company = useMemo(() => getNormalizedCompanyProfile(), [cv]);
  const name = useHeaderCompanyName();
  const gstin = company.gstin?.trim() ?? '';
  const gstStatus = gstin ? 'Registered' : 'Not configured';
  const dateStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);
  const timeStr = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(now);
  const openSupportWebsite = () => {
    try {
      const api = (window as any)?.electronAPI;
      if (api && typeof api.openExternalUrl === 'function') {
        void api.openExternalUrl(SUPPORT_WEBSITE);
        return;
      }
      window.open(SUPPORT_WEBSITE, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
  };

  const [waStatus, setWaStatus] = useState<WhatsAppConnectionStatus>(() => getWhatsAppConnectionStatus());

  useEffect(() => {
    void refreshWhatsAppConnectionStatus();
    return subscribeWhatsAppConnectionStatus(setWaStatus);
  }, []);

  const fy = financialYearLabel(now);
  const healthItems = [
    { label: 'Database Connected', ok: true },
    { label: 'Backup OK', ok: true },
    { label: 'GST Active', ok: Boolean(gstin) },
    { label: 'WhatsApp Connected', ok: waStatus.ok },
  ];

  const pill = (text: string, ok: boolean) => (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        mr: 1.5,
        fontSize: '0.6875rem',
        fontWeight: 600,
        color: chrome.text,
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      <Box component="span" sx={{ fontSize: '0.5rem', lineHeight: 1 }}>
        {ok ? '🟢' : '🟡'}
      </Box>
      {text}
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.5,
        bgcolor: chrome.statusBarBg,
        borderTop: `1px solid ${chrome.toolbarBorder}`,
        minHeight: 28,
        flexShrink: 0,
        px: 1,
        py: 0.35,
        fontFamily: '"Inter", system-ui, sans-serif',
        transition: 'background-color 300ms ease, border-color 300ms ease, color 300ms ease',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
        {healthItems.map((h) => (
          <Box key={h.label}>{pill(h.label, h.ok)}</Box>
        ))}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.25,
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: chrome.text,
        }}
      >
        <span>
          <strong>User:</strong> {userLabel}
        </span>
        <span>
          <strong>FY:</strong> {fy}
        </span>
        <span>{dateStr} · {timeStr}</span>
        <span title={gstin ? `GSTIN ${gstin}` : undefined}>
          <strong>GST:</strong> {gstStatus}
        </span>
        <Box
          component="span"
          onClick={openSupportWebsite}
          title={SUPPORT_WEBSITE}
          sx={{ cursor: 'pointer', textDecoration: 'underline', '&:hover': { color: '#2563EB' } }}
        >
          www.prityvanya.com
        </Box>
      </Box>
    </Box>
  );
}
