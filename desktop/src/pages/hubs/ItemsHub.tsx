import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { ModuleDeskShell, type ModuleDeskCategory, type ModuleDeskLink } from '../../components/erp/ModuleDeskShell';

const CATEGORIES: ModuleDeskCategory[] = [
  { id: 'all', label: 'All', icon: <Inventory2OutlinedIcon fontSize="small" /> },
  { id: 'items', label: 'Items', icon: <Inventory2OutlinedIcon fontSize="small" /> },
  { id: 'inventory', label: 'Inventory Tools', icon: <TuneOutlinedIcon fontSize="small" /> },
  { id: 'reports', label: 'Stock Reports', icon: <WarningAmberOutlinedIcon fontSize="small" /> },
];

const LINKS: ModuleDeskLink[] = [
  {
    id: 'item-list',
    label: 'All Items',
    description: 'Browse, search and manage inventory masters',
    path: '/masters/inventory-items',
    categoryId: 'items',
  },
  {
    id: 'new-item',
    label: 'New Item',
    description: 'Add a product or service item',
    path: '/masters/inventory-items/new',
    categoryId: 'items',
  },
  {
    id: 'godowns',
    label: 'Godowns / Warehouses',
    description: 'Storage locations for stock tracking',
    path: '/masters/godowns',
    categoryId: 'items',
  },
  {
    id: 'price-lists',
    label: 'Price Lists',
    description: 'Party-wise or standard rate lists',
    path: '/masters/price-lists',
    categoryId: 'inventory',
  },
  {
    id: 'new-price-list',
    label: 'New Price List',
    description: 'Create rates for customers or groups',
    path: '/masters/price-lists/new',
    categoryId: 'inventory',
  },
  {
    id: 'stock-adjustments',
    label: 'Inventory Adjustments',
    description: 'Increase or decrease stock with reason',
    path: '/masters/stock-adjustments',
    categoryId: 'inventory',
  },
  {
    id: 'new-adjustment',
    label: 'New Stock Adjustment',
    description: 'Record physical stock correction',
    path: '/masters/stock-adjustments/new',
    categoryId: 'inventory',
  },
  {
    id: 'low-stock',
    label: 'Low Stock Report',
    description: 'Items below reorder level',
    path: '/reports/low-stock',
    categoryId: 'reports',
  },
  {
    id: 'stock-summary',
    label: 'Stock Summary',
    description: 'Inventory valuation and movement reports',
    path: '/reports?view=stock',
    categoryId: 'reports',
  },
];

export default function ItemsHub() {
  const navigate = useNavigate();
  const [categoryId, setCategoryId] = useState('all');
  const [search, setSearch] = useState('');

  return (
    <ModuleDeskShell
      title="Items"
      subtitle="Products, price lists, godowns and stock adjustments — auto accounting unchanged."
      categories={CATEGORIES}
      links={LINKS}
      selectedCategoryId={categoryId}
      onCategoryChange={setCategoryId}
      searchQuery={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search items tools…"
      onNavigate={(path) => navigate(path)}
    />
  );
}
