import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import { useLocation, type NavigateFunction } from 'react-router-dom';
import { formatIndianFinancialYearLabel } from '../../utils/indianFY';
import { getNormalizedCompanyProfile } from '../../utils/companyProfile';
import { APP_DISPLAY_NAME } from '@/constants/appBranding';

/** Row heights for layout spacer math (title + menu below frame). */
export const ERP_TITLE_ROW_PX = 40;
export const ERP_MENU_ROW_PX = 36;

/** Tally/Busy–style desktop ERP chrome */
export const ERP_HEADER_BG = '#1B3A6B';
export const ERP_MENU_BG = '#2D5086';
export const ERP_SELECT = '#FFC107';
export const ERP_WORKSPACE_BG = '#F0F4F8';
export const ERP_TEXT = '#1B3A6B';

type MenuEntry = { label: string; path: string; perm?: string };

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

const ERP_MENUS: { id: string; label: string; items: MenuEntry[] }[] = [
  {
    id: 'company',
    label: 'Company',
    items: [
      { label: 'Settings', path: '/settings', perm: 'manage-settings' },
      { label: 'Dashboard', path: '/dashboard' },
    ],
  },
  {
    id: 'masters',
    label: 'Masters',
    items: [
      { label: 'Ledger Accounts', path: '/masters/ledger-accounts' },
      { label: 'Bank Accounts', path: '/masters/bank-accounts' },
      { label: 'Godowns', path: '/masters/godowns' },
      { label: 'Inventory Items', path: '/masters/inventory-items' },
      { label: 'Party Master', path: '/parties' },
      { label: 'Party Ledger', path: '/parties/ledger-report' },
    ],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    items: [
      { label: 'Voucher Entry', path: '/vouchers' },
      { label: 'Payment & Receipt', path: '/vouchers/money' },
      { label: 'Expenses', path: '/expenses' },
      { label: 'Payments', path: '/payments' },
      { label: 'Sales / Purchase Invoices', path: '/purchase-invoices' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: [
      { label: 'Reports', path: '/reports' },
      { label: 'GST', path: '/gst' },
    ],
  },
  {
    id: 'display',
    label: 'Display',
    items: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Schemes', path: '/schemes' },
    ],
  },
  {
    id: 'utilities',
    label: 'Utilities',
    items: [{ label: 'Upload from Tally/Busy/Marg', path: '/import/erp' }],
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
    return () => window.removeEventListener('companyProfileUpdated', bump);
  }, []);
  return v;
}

export function DesktopErpTitleBar() {
  const now = useNowTick(30_000);
  const cv = useCompanyProfileVersion();
  const company = useMemo(() => getNormalizedCompanyProfile(), [cv]);
  const fy = formatIndianFinancialYearLabel(now);
  const name = company.businessName || company.name || APP_DISPLAY_NAME;

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

  return (
    <Box
      sx={{
        bgcolor: ERP_HEADER_BG,
        color: '#fff',
        px: 1.5,
        py: 0.75,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        minHeight: ERP_TITLE_ROW_PX,
        borderBottom: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', letterSpacing: 0.2 }} noWrap>
        {name} <Box component="span" sx={{ opacity: 0.85, fontWeight: 500 }}>· {fy}</Box>
      </Typography>
      <Typography variant="body2" sx={{ fontSize: '0.75rem', opacity: 0.95, flexShrink: 0 }} noWrap>
        {dateStr} · {timeStr}
      </Typography>
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
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      setAnchorEl(null);
      setOpenId(null);
    }, 180);
  };

  const openMenu = (e: React.MouseEvent<HTMLElement>, id: string) => {
    clearCloseTimer();
    setAnchorEl(e.currentTarget);
    setOpenId(id);
  };

  const closeNow = () => {
    clearCloseTimer();
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

  return (
    <Box
      sx={{
        bgcolor: ERP_MENU_BG,
        color: '#fff',
        display: 'flex',
        alignItems: 'stretch',
        minHeight: ERP_MENU_ROW_PX,
        borderBottom: '1px solid rgba(0,0,0,0.15)',
        userSelect: 'none',
        position: 'relative',
        overflow: 'visible',
        zIndex: 1,
      }}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={scheduleClose}
    >
      {filteredMenus.map((m) => {
        const isActive = m.items.some((it) => {
          const base = it.path.split('?')[0];
          return location.pathname === base || location.pathname.startsWith(`${base}/`);
        });
        return (
          <Box
            key={m.id}
            component="button"
            type="button"
            onMouseEnter={(e) => openMenu(e, m.id)}
            onFocus={(e) => openMenu(e as unknown as React.MouseEvent<HTMLElement>, m.id)}
            sx={{
              border: 0,
              cursor: 'pointer',
              px: 1.75,
              py: 0.75,
              fontSize: '0.8125rem',
              fontWeight: isActive ? 700 : 500,
              bgcolor: openId === m.id ? 'rgba(0,0,0,0.12)' : 'transparent',
              color: '#fff',
              fontFamily: 'inherit',
              borderRight: '1px solid rgba(255,255,255,0.12)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.18)' },
            }}
          >
            {m.label}
          </Box>
        );
      })}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(activeMenu && anchorEl)}
        onClose={closeNow}
        MenuListProps={{
          dense: true,
          sx: {
            py: 0,
            minWidth: 200,
            bgcolor: '#f8fafc',
            border: '1px solid #cbd5e1',
            '& .MuiMenuItem-root': {
              fontSize: '0.8125rem',
              minHeight: 32,
              color: ERP_TEXT,
              borderBottom: '1px solid #e2e8f0',
              '&:hover': { bgcolor: ERP_SELECT },
              '&.Mui-selected': { bgcolor: ERP_SELECT, color: ERP_TEXT, fontWeight: 700 },
              '&.Mui-selected:hover': { bgcolor: ERP_SELECT },
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
            onMouseEnter: clearCloseTimer,
            onMouseLeave: scheduleClose,
          },
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {activeMenu?.items.map((it) => {
          const base = it.path.split('?')[0];
          const q = it.path.includes('?') ? `?${it.path.split('?')[1]}` : '';
          const selected =
            location.pathname === base && (!q || location.search === q || location.search.startsWith(`${q}&`));
          return (
            <MenuItem
              key={it.path + it.label}
              selected={selected}
              onClick={() => {
                erpNavigateTo(navigate, it.path.startsWith('/') ? it.path : `/${it.path}`);
                closeNow();
              }}
            >
              {it.label}
            </MenuItem>
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
  const now = useNowTick(60_000);
  const cv = useCompanyProfileVersion();
  const company = useMemo(() => getNormalizedCompanyProfile(), [cv]);
  const fy = formatIndianFinancialYearLabel(now);
  const name = company.businessName || company.name || '—';
  const gstin = company.gstin?.trim() ?? '';
  const gstStatus = gstin ? 'Registered' : 'Not configured';
  const dateStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);

  const cell = (content: React.ReactNode) => (
    <Box
      sx={{
        px: 1.25,
        py: 0.4,
        borderRight: '1px solid #cbd5e1',
        fontSize: '0.75rem',
        color: ERP_TEXT,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {content}
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        flexWrap: 'wrap',
        bgcolor: '#e2e8f0',
        borderTop: '1px solid #cbd5e1',
        minHeight: 26,
        flexShrink: 0,
      }}
    >
      {cell(<strong>{APP_DISPLAY_NAME}</strong>)}
      {cell(<span>{name}</span>)}
      {cell(<span>{fy}</span>)}
      {cell(
        <span>
          <strong>User:</strong> {userLabel}
        </span>
      )}
      {cell(<span>{dateStr}</span>)}
      {cell(
        <span title={gstin ? `GSTIN ${gstin}` : undefined}>
          <strong>GST Status:</strong> {gstStatus}
          {gstin ? (
            <Box component="span" sx={{ opacity: 0.85, ml: 0.75 }}>
              ({gstin})
            </Box>
          ) : null}
        </span>
      )}
      {canAccessFeature('manage-settings')
        ? cell(
            <span title="Keyboard shortcuts">
              <strong>F1</strong> Help · <strong>ESC</strong> Back · <strong>Enter</strong> Select
            </span>
          )
        : cell(
            <span>
              <strong>ESC</strong> Back · <strong>Enter</strong> Select
            </span>
          )}
    </Box>
  );
}
