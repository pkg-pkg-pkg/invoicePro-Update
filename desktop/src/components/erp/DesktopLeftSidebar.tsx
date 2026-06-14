import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { ERP_PRIMARY_MODULES, moduleMatchesPath, type ErpModuleNavItem } from '../../config/erpModuleNav';
import { SALES_NAV_ITEMS } from '../../config/salesModuleNav';
import { PURCHASE_NAV_ITEMS } from '../../config/purchaseModuleNav';
import { ITEMS_NAV_ITEMS } from '../../config/itemsModuleNav';
import { getErpChromeColors } from '../../theme/erpColors';
import { useHeaderCompanyName } from './DesktopErpChrome';
import {
  itemsModuleExpanded,
  itemsSubNavActive,
  purchaseModuleExpanded,
  purchaseSubNavActive,
  salesModuleExpanded,
  salesSubNavActive,
} from '../../utils/moduleSubNav';
import { prefetchRoutePath } from '../../app/prefetchRoutes';

function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

const SIDEBAR_COLLAPSED_PX = 56;
const SIDEBAR_EXPANDED_PX = 220;
const STORAGE_KEY = 'pve_sidebar_expanded';

const ICON_MAP = {
  Home: HomeOutlinedIcon,
  Inventory2: Inventory2OutlinedIcon,
  AccountBalance: AccountBalanceOutlinedIcon,
  PointOfSale: PointOfSaleOutlinedIcon,
  ShoppingCart: ShoppingCartOutlinedIcon,
  People: PeopleOutlineIcon,
  Assessment: AssessmentOutlinedIcon,
  ReceiptLong: ReceiptLongOutlinedIcon,
  Settings: SettingsOutlinedIcon,
  CardGiftcard: CardGiftcardOutlinedIcon,
  Today: TodayOutlinedIcon,
} as const;

const MODULES_WITH_SUBNAV = new Set(['items', 'sales', 'purchase']);

type ExpandedParent = 'items' | 'sales' | 'purchase' | null;

function readExpanded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function detectExpandedParent(pathname: string): ExpandedParent {
  if (itemsModuleExpanded(pathname)) return 'items';
  if (salesModuleExpanded(pathname)) return 'sales';
  if (purchaseModuleExpanded(pathname)) return 'purchase';
  return null;
}

type Props = {
  canAccessFeature: (feature: string) => boolean;
  gstEnabled: boolean;
};

export function DesktopLeftSidebar({ canAccessFeature, gstEnabled }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const chrome = useMemo(() => getErpChromeColors(isDark ? 'premium-dark' : 'light'), [isDark]);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarExpanded, setSidebarExpanded] = useState(readExpanded);
  const [expandedParent, setExpandedParent] = useState<ExpandedParent>(() =>
    detectExpandedParent(location.pathname)
  );

  useEffect(() => {
    const next = detectExpandedParent(location.pathname);
    setExpandedParent((prev) => (prev === next ? prev : next));
  }, [location.pathname]);

  const modules = useMemo(
    () =>
      ERP_PRIMARY_MODULES.filter((m) => {
        if (m.gstOnly && !gstEnabled) return false;
        if (m.perm && !canAccessFeature(m.perm)) return false;
        return true;
      }),
    [canAccessFeature, gstEnabled]
  );

  const toggleSidebar = useCallback(() => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const width = sidebarExpanded ? SIDEBAR_EXPANDED_PX : SIDEBAR_COLLAPSED_PX;
  const companyName = useHeaderCompanyName();
  const sidebarCompanyLabel = companyName.trim() || 'Company';

  const toggleParent = (parent: ExpandedParent, defaultPath: string) => {
    if (!sidebarExpanded) {
      navigate(defaultPath);
      return;
    }
    const willClose = expandedParent === parent;
    const nextParent: ExpandedParent = willClose ? null : parent;
    setExpandedParent(nextParent);
    if (!willClose) {
      const needsNav =
        (parent === 'items' && !itemsModuleExpanded(location.pathname)) ||
        (parent === 'sales' && !salesModuleExpanded(location.pathname)) ||
        (parent === 'purchase' && !purchaseModuleExpanded(location.pathname));
      if (needsNav) {
        navigate(defaultPath);
      }
    }
  };

  const wrapTooltip = (title: string, node: ReactNode) => (
    <Tooltip title={title} placement="right" arrow>
      <span style={{ display: 'block', width: '100%' }}>{node}</span>
    </Tooltip>
  );

  const renderSubItem = (
    label: string,
    path: string,
    active: boolean,
    variant: 'default' | 'items' = 'default'
  ) => (
    <Box
      key={path}
      component="button"
      type="button"
      onClick={() => navigate(path)}
      onMouseEnter={() => prefetchRoutePath(path)}
      onFocus={() => prefetchRoutePath(path)}
      aria-current={active ? 'page' : undefined}
      sx={
        variant === 'items'
          ? {
              display: 'block',
              width: '100%',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              padding: '6px 16px 6px 40px',
              bgcolor: 'transparent',
              color: active ? '#185FA5' : '#94a3b8',
              transition: 'color 0.2s ease',
              '&:hover': {
                color: active ? '#185FA5' : '#cbd5e1',
              },
            }
          : {
              display: 'block',
              width: '100%',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
              padding: '8px 16px 8px 40px',
              bgcolor: active ? '#1e40af' : 'transparent',
              color: active ? '#fff' : '#94a3b8',
              borderLeft: active ? '3px solid #60a5fa' : '3px solid transparent',
              transition: 'background-color 0.2s ease, color 0.2s ease',
              '&:hover': {
                bgcolor: active ? '#1e40af' : 'rgba(255,255,255,0.08)',
                color: active ? '#fff' : '#cbd5e1',
              },
            }
      }
    >
      {label}
    </Box>
  );

  const renderParentButton = (
    mod: ErpModuleNavItem,
    opts: {
      hasChildren: boolean;
      isParentOpen: boolean;
      parentActive: boolean;
      onClick: () => void;
      prefetchPath?: string;
    }
  ) => {
    const Icon = ICON_MAP[mod.icon];
    return (
      <Box
        component="button"
        type="button"
        onClick={opts.onClick}
        onMouseEnter={() => opts.prefetchPath && prefetchRoutePath(opts.prefetchPath)}
        onFocus={() => opts.prefetchPath && prefetchRoutePath(opts.prefetchPath)}
        aria-expanded={opts.hasChildren ? opts.isParentOpen : undefined}
        aria-current={opts.parentActive && !opts.hasChildren ? 'page' : undefined}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          width: '100%',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: 14,
          py: 1.5,
          px: sidebarExpanded ? 2 : 0,
          justifyContent: sidebarExpanded ? 'flex-start' : 'center',
          bgcolor: opts.parentActive ? (isDark ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.12)') : 'transparent',
          color: opts.parentActive ? chrome.menuActive : chrome.menuText,
          borderLeft: opts.parentActive ? `3px solid ${chrome.menuActive}` : '3px solid transparent',
          transition: theme.transitions.create(['background-color', 'color'], { duration: 200 }),
          '&:hover': {
            bgcolor: opts.parentActive
              ? isDark
                ? 'rgba(37, 99, 235, 0.22)'
                : 'rgba(37, 99, 235, 0.16)'
              : 'rgba(255,255,255,0.08)',
          },
        }}
      >
        <Icon sx={{ fontSize: 22, flexShrink: 0 }} />
        {sidebarExpanded ? (
          <>
            <Typography variant="body2" sx={{ fontWeight: opts.parentActive ? 700 : 500, fontSize: 14, flex: 1 }} noWrap>
              {mod.label}
            </Typography>
            {opts.hasChildren ? (
              <ChevronRightOutlinedIcon
                sx={{
                  fontSize: 18,
                  opacity: 0.75,
                  transform: opts.isParentOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
            ) : null}
          </>
        ) : null}
      </Box>
    );
  };

  const renderModule = (mod: ErpModuleNavItem) => {
    const hasChildren = MODULES_WITH_SUBNAV.has(mod.id);
    const parentActive = moduleMatchesPath(mod, location.pathname);
    const isParentOpen = expandedParent === mod.id;

    if (mod.id === 'items' && hasChildren) {
      const btn = renderParentButton(mod, {
        hasChildren: true,
        isParentOpen,
        parentActive,
        onClick: () => toggleParent('items', '/items'),
        prefetchPath: '/items',
      });
      return (
        <Box key={mod.id}>
          {sidebarExpanded ? btn : wrapTooltip(mod.label, btn)}
          {sidebarExpanded && isParentOpen ? (
            <Box sx={{ overflow: 'hidden', pb: 0.5 }}>
              {ITEMS_NAV_ITEMS.map((item) =>
                renderSubItem(item.label, item.path, itemsSubNavActive(item.id, location.pathname), 'items')
              )}
            </Box>
          ) : null}
        </Box>
      );
    }

    if (mod.id === 'sales' && hasChildren) {
      const btn = renderParentButton(mod, {
        hasChildren: true,
        isParentOpen,
        parentActive,
        onClick: () => toggleParent('sales', '/sales/tax-invoices'),
        prefetchPath: '/sales/tax-invoices',
      });
      return (
        <Box key={mod.id}>
          {sidebarExpanded ? btn : wrapTooltip(mod.label, btn)}
          {sidebarExpanded && isParentOpen ? (
            <Box sx={{ overflow: 'hidden' }}>
              {SALES_NAV_ITEMS.map((item) =>
                renderSubItem(item.tabLabel, `/sales/${item.kind}`, salesSubNavActive(item.kind, location.pathname))
              )}
            </Box>
          ) : null}
        </Box>
      );
    }

    if (mod.id === 'purchase' && hasChildren) {
      const btn = renderParentButton(mod, {
        hasChildren: true,
        isParentOpen,
        parentActive,
        onClick: () => toggleParent('purchase', '/purchase/purchase-bills'),
        prefetchPath: '/purchase/purchase-bills',
      });
      return (
        <Box key={mod.id}>
          {sidebarExpanded ? btn : wrapTooltip(mod.label, btn)}
          {sidebarExpanded && isParentOpen ? (
            <Box sx={{ overflow: 'hidden' }}>
              {PURCHASE_NAV_ITEMS.map((item) =>
                renderSubItem(
                  item.tabLabel,
                  `/purchase/${item.kind}`,
                  purchaseSubNavActive(item.kind, location.pathname)
                )
              )}
            </Box>
          ) : null}
        </Box>
      );
    }

    const btn = renderParentButton(mod, {
      hasChildren: false,
      isParentOpen: false,
      parentActive,
      onClick: () => navigate(mod.path),
      prefetchPath: mod.path,
    });

    return sidebarExpanded ? (
      <Box key={mod.id}>{btn}</Box>
    ) : (
      <Box key={mod.id}>{wrapTooltip(mod.label, btn)}</Box>
    );
  };

  return (
    <Box
      component="nav"
      aria-label="Main modules"
      sx={{
        display: { xs: 'none', sm: 'flex' },
        flexDirection: 'column',
        flexShrink: 0,
        alignSelf: 'stretch',
        width,
        minWidth: width,
        height: '100%',
        bgcolor: chrome.menuBg,
        borderRight: `1px solid ${chrome.headerBorder}`,
        color: chrome.menuText,
        transition: theme.transitions.create('width', { duration: 250 }),
        overflow: 'hidden',
        minHeight: 0,
        zIndex: theme.zIndex.drawer,
      }}
    >
      <Box
        sx={{
          px: sidebarExpanded ? 2 : 0,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarExpanded ? 'flex-start' : 'center',
          borderBottom: `1px solid ${chrome.headerBorder}`,
          minHeight: 44,
        }}
      >
        {sidebarExpanded ? (
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, letterSpacing: '0.02em', opacity: 0.92, lineHeight: 1.25 }}
            noWrap
            title={sidebarCompanyLabel}
          >
            {sidebarCompanyLabel}
          </Typography>
        ) : (
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.04em' }}
            title={sidebarCompanyLabel}
          >
            {companyInitials(sidebarCompanyLabel)}
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          py: 0.5,
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: isDark ? 'rgba(148,163,184,0.35)' : 'rgba(15,23,42,0.2)',
            borderRadius: 3,
          },
        }}
      >
        {modules.map(renderModule)}
      </Box>

      <Box sx={{ borderTop: `1px solid ${chrome.headerBorder}`, py: 0.5 }}>
        <Tooltip title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'} placement="right">
          <span style={{ display: 'block', width: '100%' }}>
            <IconButton
              size="small"
              onClick={toggleSidebar}
              sx={{
                width: '100%',
                borderRadius: 0,
                color: chrome.menuText,
                py: 1,
              }}
            >
              {sidebarExpanded ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

export const ERP_SIDEBAR_WIDTH = SIDEBAR_EXPANDED_PX;
