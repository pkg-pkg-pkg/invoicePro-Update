import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { ModuleDeskShell, type ModuleDeskCategory, type ModuleDeskLink } from '../../components/erp/ModuleDeskShell';

const CATEGORIES: ModuleDeskCategory[] = [
  { id: 'all', label: 'All', icon: <ShoppingCartOutlinedIcon fontSize="small" /> },
  { id: 'purchase', label: 'Purchase', icon: <ShoppingCartOutlinedIcon fontSize="small" /> },
  { id: 'returns', label: 'Returns', icon: <AssignmentReturnOutlinedIcon fontSize="small" /> },
  { id: 'bills', label: 'Bills', icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
];

const LINKS: ModuleDeskLink[] = [
  {
    id: 'purchase-list',
    label: 'Purchase Vouchers',
    description: 'Supplier purchase entries',
    path: '/vouchers/purchase',
    categoryId: 'purchase',
  },
  {
    id: 'new-purchase',
    label: 'New Purchase Bill',
    description: 'Record supplier invoice with GST',
    path: '/vouchers/purchase/new',
    categoryId: 'purchase',
  },
  {
    id: 'purchase-return',
    label: 'Purchase Return',
    description: 'Debit notes to supplier',
    path: '/vouchers/purchase-return',
    categoryId: 'returns',
  },
  {
    id: 'new-purchase-return',
    label: 'New Purchase Return',
    description: 'Return goods to supplier',
    path: '/vouchers/purchase-return/new',
    categoryId: 'returns',
  },
  {
    id: 'purchase-invoices',
    label: 'Purchase Invoices',
    description: 'Legacy purchase invoice list',
    path: '/purchase-invoices',
    categoryId: 'bills',
  },
  {
    id: 'debit-notes',
    label: 'Debit Notes',
    description: 'Purchase return documents',
    path: '/debit-notes',
    categoryId: 'bills',
  },
  {
    id: 'purchase-reports',
    label: 'Purchase Reports',
    description: 'Analysis and register',
    path: '/reports?view=purchase',
    categoryId: 'purchase',
  },
  {
    id: 'suppliers',
    label: 'Suppliers (Party Master)',
    description: 'Manage vendor accounts',
    path: '/parties',
    categoryId: 'purchase',
  },
];

export default function PurchaseHub() {
  const navigate = useNavigate();
  const [categoryId, setCategoryId] = useState('all');
  const [search, setSearch] = useState('');

  return (
    <ModuleDeskShell
      title="Purchase"
      subtitle="Supplier bills, returns and payables."
      categories={CATEGORIES}
      links={LINKS}
      selectedCategoryId={categoryId}
      onCategoryChange={setCategoryId}
      searchQuery={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search purchase…"
      onNavigate={(path) => navigate(path)}
    />
  );
}
