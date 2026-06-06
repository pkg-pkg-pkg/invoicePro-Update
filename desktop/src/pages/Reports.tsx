import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Tab,
  Tabs,
  Typography,
  Alert,
  Stack,
  Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Receipt as ReceiptIcon,
  ShoppingCart as ShoppingCartIcon,
  Inventory as InventoryIcon,
  AccountBalance as AccountBalanceIcon,
  People as PeopleIcon,
  Payment as PaymentIcon,
  TrendingUp as TrendingUpIcon,
  AssessmentOutlined as AssessmentOutlinedIcon,
} from '@mui/icons-material';
import SalesReports from './Reports/SalesReports';
import PurchaseReports from './Reports/PurchaseReports';
import StockReports from './Reports/StockReports';
import FinancialReports from './Reports/FinancialReports';
import PartyReports from './Reports/PartyReports';
import PaymentReports from './Reports/PaymentReports';
import PreGstProfitReports from './Reports/PreGstProfitReports';
import { usePermissions } from '../hooks/usePermissions';
import { useLocation } from 'react-router-dom';
import { PREMIUM_ERP } from '../theme/premiumErpTheme';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`reports-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const reportCategories = [
  {
    id: 'sales',
    label: 'Sales',
    icon: <ReceiptIcon fontSize="small" />,
    color: PREMIUM_ERP.categoryColors.sales,
  },
  {
    id: 'purchase',
    label: 'Purchase',
    icon: <ShoppingCartIcon fontSize="small" />,
    color: PREMIUM_ERP.categoryColors.purchase,
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: <InventoryIcon fontSize="small" />,
    color: PREMIUM_ERP.categoryColors.stock,
  },
  {
    id: 'financial',
    label: 'Financial',
    icon: <AccountBalanceIcon fontSize="small" />,
    color: PREMIUM_ERP.categoryColors.financial,
  },
  {
    id: 'party',
    label: 'Party',
    icon: <PeopleIcon fontSize="small" />,
    color: PREMIUM_ERP.categoryColors.party,
  },
  {
    id: 'payment',
    label: 'Payment',
    icon: <PaymentIcon fontSize="small" />,
    color: PREMIUM_ERP.categoryColors.payment,
  },
  {
    id: 'pre-gst-profit',
    label: 'Profit',
    icon: <TrendingUpIcon fontSize="small" />,
    color: PREMIUM_ERP.categoryColors.profit,
  },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState(0);
  const location = useLocation();
  const { canAccessFeature } = usePermissions();
  const canView = canAccessFeature('view-reports');
  const canExport = canAccessFeature('export-reports');

  if (!canView) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You do not have permission to view reports</Alert>
      </Box>
    );
  }

  useEffect(() => {
    const view = new URLSearchParams(location.search).get('view') || '';
    const map: Record<string, number> = {
      sales: 0,
      purchase: 1,
      stock: 2,
      financial: 3,
      party: 4,
      payment: 5,
      'pre-gst-profit': 6,
      pnl: 6,
    };
    const next = map[String(view).toLowerCase()];
    if (next !== undefined) setActiveTab(next);
  }, [location.search]);

  const activeCategory = reportCategories[activeTab];

  return (
    <Box
      sx={{
        fontFamily: PREMIUM_ERP.fontFamily,
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
        minHeight: '100%',
        bgcolor: PREMIUM_ERP.bg,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          mb: 3,
          borderRadius: `${PREMIUM_ERP.radius.lg}px`,
          background: PREMIUM_ERP.gradient,
          color: '#fff',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.18)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
          <AssessmentOutlinedIcon />
          <Typography variant="h4" fontWeight={800} letterSpacing="-0.03em">
            Reports & Analytics
          </Typography>
        </Stack>
        <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: 640 }}>
          Premium business intelligence — filters, exports, favorites, and detailed analytics across
          sales, purchase, stock, and finance.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label="Export PDF / Excel"
            sx={{ bgcolor: alpha('#fff', 0.14), color: '#fff', fontWeight: 600 }}
          />
          <Chip
            size="small"
            label="Sticky tables"
            sx={{ bgcolor: alpha('#fff', 0.14), color: '#fff', fontWeight: 600 }}
          />
          <Chip
            size="small"
            label="Favorites"
            sx={{ bgcolor: alpha('#fff', 0.14), color: '#fff', fontWeight: 600 }}
          />
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          borderRadius: `${PREMIUM_ERP.radius.lg}px`,
          border: `1px solid ${PREMIUM_ERP.border}`,
          boxShadow: PREMIUM_ERP.shadow,
          overflow: 'hidden',
          bgcolor: PREMIUM_ERP.card,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_e, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            borderBottom: `1px solid ${PREMIUM_ERP.border}`,
            '& .MuiTab-root': {
              minHeight: 56,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.875rem',
              borderRadius: `${PREMIUM_ERP.radius.sm}px`,
              mx: 0.25,
              my: 0.75,
              transition: PREMIUM_ERP.transition,
            },
            '& .Mui-selected': {
              bgcolor: alpha(activeCategory?.color || PREMIUM_ERP.blue, 0.08),
            },
          }}
        >
          {reportCategories.map((cat) => (
            <Tab
              key={cat.id}
              label={cat.label}
              icon={
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(cat.color, 0.12),
                    color: cat.color,
                  }}
                >
                  {cat.icon}
                </Box>
              }
              iconPosition="start"
            />
          ))}
        </Tabs>

        <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
          <TabPanel value={activeTab} index={0}>
            <SalesReports canExport={canExport} />
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            <PurchaseReports canExport={canExport} />
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <StockReports canExport={canExport} />
          </TabPanel>
          <TabPanel value={activeTab} index={3}>
            <FinancialReports canExport={canExport} />
          </TabPanel>
          <TabPanel value={activeTab} index={4}>
            <PartyReports canExport={canExport} />
          </TabPanel>
          <TabPanel value={activeTab} index={5}>
            <PaymentReports canExport={canExport} />
          </TabPanel>
          <TabPanel value={activeTab} index={6}>
            <PreGstProfitReports canExport={canExport} />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}
