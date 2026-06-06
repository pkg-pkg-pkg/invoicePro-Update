import { Box, Tab, Tabs } from '@mui/material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

export function CustomersModuleShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const tab =
    location.pathname.startsWith('/customers/ledger-report') ? 'ledger' : 'customers';

  const isDetailPage =
    /^\/customers\/[^/]+$/.test(location.pathname) &&
    !location.pathname.startsWith('/customers/ledger-report');

  return (
    <Box sx={{ minHeight: '100%' }}>
      {!isDetailPage ? (
        <Tabs
          value={tab}
          onChange={(_, value) => navigate(value === 'ledger' ? '/customers/ledger-report' : '/customers')}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Customers" value="customers" sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label="Ledger Report" value="ledger" sx={{ textTransform: 'none', fontWeight: 700 }} />
        </Tabs>
      ) : null}
      <Outlet />
    </Box>
  );
}
