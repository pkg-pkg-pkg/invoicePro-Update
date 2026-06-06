import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import { ModuleDeskShell, type ModuleDeskCategory, type ModuleDeskLink } from '../../components/erp/ModuleDeskShell';

const CATEGORIES: ModuleDeskCategory[] = [
  { id: 'all', label: 'All', icon: <PointOfSaleOutlinedIcon fontSize="small" /> },
  { id: 'sales', label: 'Sales', icon: <PointOfSaleOutlinedIcon fontSize="small" /> },
  { id: 'parties', label: 'Customers', icon: <PeopleOutlineIcon fontSize="small" /> },
  { id: 'returns', label: 'Returns', icon: <AssignmentReturnOutlinedIcon fontSize="small" /> },
];

const LINKS: ModuleDeskLink[] = [
  {
    id: 'sales-list',
    label: 'Sales Invoices',
    description: 'All sales vouchers and bills',
    path: '/vouchers/sales',
    categoryId: 'sales',
  },
  {
    id: 'new-sales',
    label: 'New Sales Invoice',
    description: 'Create customer bill with GST',
    path: '/vouchers/sales/new',
    categoryId: 'sales',
  },
  {
    id: 'voucher-desk',
    label: 'Voucher Control Desk',
    description: 'Quick access to all voucher types',
    path: '/vouchers',
    categoryId: 'sales',
  },
  {
    id: 'parties',
    label: 'Party Master',
    description: 'Customers and suppliers',
    path: '/parties',
    categoryId: 'parties',
  },
  {
    id: 'new-party',
    label: 'New Customer / Supplier',
    description: 'Add party with GST and contact',
    path: '/parties/new',
    categoryId: 'parties',
  },
  {
    id: 'party-ledger',
    label: 'Party Ledger Report',
    description: 'Outstanding and statement by party',
    path: '/parties/ledger-report',
    categoryId: 'parties',
  },
  {
    id: 'sales-return',
    label: 'Sales Return',
    description: 'Credit notes and customer returns',
    path: '/vouchers/sales-return',
    categoryId: 'returns',
  },
  {
    id: 'new-sales-return',
    label: 'New Sales Return',
    description: 'Record returned goods from customer',
    path: '/vouchers/sales-return/new',
    categoryId: 'returns',
  },
  {
    id: 'sales-reports',
    label: 'Sales Reports',
    description: 'Analysis, register and summaries',
    path: '/reports?view=sales',
    categoryId: 'sales',
  },
  {
    id: 'outstanding',
    label: 'Outstanding Aging',
    description: 'Receivables due analysis',
    path: '/reports/outstanding-aging',
    categoryId: 'parties',
  },
];

export default function SalesHub() {
  const navigate = useNavigate();
  const [categoryId, setCategoryId] = useState('all');
  const [search, setSearch] = useState('');

  return (
    <ModuleDeskShell
      title="Sales"
      subtitle="Invoices, customers, returns and receivables."
      categories={CATEGORIES}
      links={LINKS}
      selectedCategoryId={categoryId}
      onCategoryChange={setCategoryId}
      searchQuery={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search sales…"
      onNavigate={(path) => navigate(path)}
    />
  );
}
