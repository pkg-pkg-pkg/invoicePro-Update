import { Box, Tab, Tabs } from '@mui/material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

function tabFromPath(pathname: string): string {
  if (pathname.startsWith('/ledgers/debtors')) return 'debtors';
  if (pathname.startsWith('/ledgers/creditors')) return 'creditors';
  if (pathname.startsWith('/ledgers/report')) return 'report';
  return 'all';
}

export function LedgersModuleShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const tab = tabFromPath(location.pathname);

  const hideTabs =
    /^\/ledgers\/debtors\/[^/]+/.test(location.pathname) ||
    location.pathname.includes('/statement');

  const tabPaths: Record<string, string> = {
    all: '/ledgers',
    debtors: '/ledgers/debtors',
    creditors: '/ledgers/creditors',
    report: '/ledgers/report',
  };

  return (
    <Box sx={{ minHeight: '100%' }}>
      {!hideTabs ? (
        <Tabs
          value={tab}
          onChange={(_, value) => navigate(tabPaths[value] ?? '/ledgers')}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="All Ledgers" value="all" sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label="Debtors" value="debtors" sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label="Creditors" value="creditors" sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label="Ledger Report" value="report" sx={{ textTransform: 'none', fontWeight: 700 }} />
        </Tabs>
      ) : null}
      <Outlet />
    </Box>
  );
}

/** @deprecated use LedgersModuleShell */
export const CustomersModuleShell = LedgersModuleShell;
