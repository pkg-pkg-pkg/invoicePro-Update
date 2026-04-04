import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Alert,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  ShoppingCart as ShoppingCartIcon,
  Inventory as InventoryIcon,
  AccountBalance as AccountBalanceIcon,
  People as PeopleIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import SalesReports from './Reports/SalesReports';
import PurchaseReports from './Reports/PurchaseReports';
import StockReports from './Reports/StockReports';
import FinancialReports from './Reports/FinancialReports';
import PartyReports from './Reports/PartyReports';
import PaymentReports from './Reports/PaymentReports';
import { usePermissions } from '../hooks/usePermissions';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reports-tabpanel-${index}`}
      aria-labelledby={`reports-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const reportCategories = [
  {
    id: 'sales',
    label: 'Sales Reports',
    icon: <ReceiptIcon />,
    description: 'Sales invoices, summaries, customer and product analysis',
  },
  {
    id: 'purchase',
    label: 'Purchase Reports',
    icon: <ShoppingCartIcon />,
    description: 'Purchase bills, supplier analysis, purchase returns',
  },
  {
    id: 'stock',
    label: 'Stock Reports',
    icon: <InventoryIcon />,
    description: 'Current stock, movements, low stock, valuation',
  },
  {
    id: 'financial',
    label: 'Financial Reports',
    icon: <AccountBalanceIcon />,
    description: 'Day book, profit & loss, balance sheet, trial balance',
  },
  {
    id: 'party',
    label: 'Party Reports',
    icon: <PeopleIcon />,
    description: 'Customer outstanding, supplier payable, aging reports',
  },
  {
    id: 'payment',
    label: 'Payment Reports',
    icon: <PaymentIcon />,
    description: 'Payment received, payment made, pending cheques',
  },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState(0);

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

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Reports
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Comprehensive business reports with filters, export options, and detailed analytics
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {reportCategories.map((category) => (
            <Tab
              key={category.id}
              label={category.label}
              icon={category.icon}
              iconPosition="start"
              sx={{ minHeight: 72 }}
            />
          ))}
        </Tabs>

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
      </Paper>
    </Box>
  );
}
