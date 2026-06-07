export type ItemsNavItem = {
  id: string;
  label: string;
  path: string;
};

export const ITEMS_NAV_ITEMS: ItemsNavItem[] = [
  { id: 'list', label: 'Items', path: '/items' },
  { id: 'price-lists', label: 'Price Lists', path: '/items/price-lists' },
  { id: 'adjustments', label: 'Inventory Adjustments', path: '/items/adjustments' },
  { id: 'godowns', label: 'Godown Master', path: '/masters/godowns' },
];
