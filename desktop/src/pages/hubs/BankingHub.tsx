import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { ModuleDeskShell, type ModuleDeskCategory, type ModuleDeskLink } from '../../components/erp/ModuleDeskShell';

const CATEGORIES: ModuleDeskCategory[] = [
  { id: 'all', label: 'All', icon: <AccountBalanceOutlinedIcon fontSize="small" /> },
  { id: 'accounts', label: 'Bank Accounts', icon: <AccountBalanceOutlinedIcon fontSize="small" /> },
  { id: 'money', label: 'Money Vouchers', icon: <PaymentOutlinedIcon fontSize="small" /> },
];

const LINKS: ModuleDeskLink[] = [
  {
    id: 'bank-accounts',
    label: 'Bank & Cash Accounts',
    description: 'View balances and manage bank ledgers',
    path: '/masters/bank-accounts',
    categoryId: 'accounts',
  },
  {
    id: 'ledger-accounts',
    label: 'All Ledger Accounts',
    description: 'Chart of accounts including banks',
    path: '/masters/ledger-accounts',
    categoryId: 'accounts',
  },
  {
    id: 'receipts',
    label: 'Receipt Vouchers',
    description: 'Money received from parties',
    path: '/vouchers/receipt-vouchers',
    categoryId: 'money',
  },
  {
    id: 'new-receipt',
    label: 'New Receipt',
    description: 'Record incoming payment',
    path: '/vouchers/receipt-vouchers/new',
    categoryId: 'money',
  },
  {
    id: 'payments',
    label: 'Payment Vouchers',
    description: 'Money paid to suppliers or expenses',
    path: '/vouchers/payment-vouchers',
    categoryId: 'money',
  },
  {
    id: 'new-payment',
    label: 'New Payment',
    description: 'Record outgoing payment',
    path: '/vouchers/payment-vouchers/new',
    categoryId: 'money',
  },
  {
    id: 'money-hub',
    label: 'Payment & Receipt Desk',
    description: 'Unified payment / receipt entry',
    path: '/vouchers/money',
    categoryId: 'money',
  },
  {
    id: 'journal',
    label: 'Journal Vouchers',
    description: 'Non-cash adjustments and transfers',
    path: '/vouchers/journal',
    categoryId: 'money',
  },
  {
    id: 'expenses',
    label: 'Expenses',
    description: 'Manual expense entries',
    path: '/expenses',
    categoryId: 'money',
  },
];

export default function BankingHub() {
  const navigate = useNavigate();
  const [categoryId, setCategoryId] = useState('all');
  const [search, setSearch] = useState('');

  return (
    <ModuleDeskShell
      title="Banking"
      subtitle="Bank accounts, receipts, payments and journals — postings remain automatic."
      categories={CATEGORIES}
      links={LINKS}
      selectedCategoryId={categoryId}
      onCategoryChange={setCategoryId}
      searchQuery={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search banking…"
      onNavigate={(path) => navigate(path)}
    />
  );
}
