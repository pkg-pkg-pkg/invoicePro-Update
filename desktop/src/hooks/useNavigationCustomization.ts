import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectAuthUser } from '../store/slices/authSlice';

export interface MenuItem {
  id: string;
  text: string;
  icon: string; // Icon name
  path: string;
  enabled: boolean;
}

export interface MenuGroup {
  id: string;
  text: string;
  icon: string;
  items: MenuItem[];
  enabled: boolean;
}

const DEFAULT_MENU_ITEMS: (MenuItem | MenuGroup)[] = [
  { id: 'dashboard', text: 'Dashboard', icon: 'Dashboard', path: '/dashboard', enabled: true },
  { id: 'items-hub', text: 'Items', icon: 'Inventory', path: '/items', enabled: true },
  { id: 'banking-hub', text: 'Banking', icon: 'AccountBalance', path: '/banking', enabled: true },
  { id: 'sales-hub', text: 'Sales', icon: 'PointOfSale', path: '/sales', enabled: true },
  { id: 'purchase-hub', text: 'Purchase', icon: 'ShoppingCart', path: '/purchase', enabled: true },
  {
    id: 'accounts',
    text: 'Accounts',
    icon: 'AccountBalance',
    enabled: true,
    items: [
      { id: 'ledger-accounts', text: 'Ledger Accounts', icon: 'AccountBalance', path: '/masters/ledger-accounts', enabled: true },
      { id: 'bank-accounts', text: 'Bank Accounts', icon: 'AccountBalance', path: '/masters/bank-accounts', enabled: true },
      { id: 'godowns', text: 'Godowns', icon: 'Inventory', path: '/masters/godowns', enabled: true },
      { id: 'inventory-items', text: 'Inventory Items', icon: 'Inventory', path: '/masters/inventory-items', enabled: true },
      { id: 'price-lists', text: 'Price Lists', icon: 'Inventory', path: '/masters/price-lists', enabled: true },
      { id: 'stock-adjustments', text: 'Stock Adjustments', icon: 'Inventory', path: '/masters/stock-adjustments', enabled: true },
      { id: 'parties', text: 'Customers', icon: 'Person', path: '/customers', enabled: true },
      {
        id: 'party-ledger-report',
        text: 'Party Ledger',
        icon: 'MenuBook',
        path: '/customers/ledger-report',
        enabled: true,
      },
      {
        id: 'import-from-erp',
        text: 'Import from accounting software',
        icon: 'CloudUpload',
        path: '/import/erp',
        enabled: true,
      },
    ],
  },
  {
    id: 'vouchers',
    text: 'Vouchers',
    icon: 'ReceiptLong',
    enabled: true,
    items: [
      { id: 'voucher-entry', text: 'Voucher Entry', icon: 'ReceiptLong', path: '/vouchers', enabled: true },
      { id: 'money-vouchers', text: 'Payment & Receipt', icon: 'Payment', path: '/vouchers/money', enabled: true },
    ],
  },
  { id: 'manual-expense', text: 'Expenses', icon: 'Payment', path: '/expenses', enabled: true },
  { id: 'gst', text: 'GST', icon: 'ReceiptLong', path: '/gst', enabled: true },
  { id: 'schemes', text: 'Schemes', icon: 'Assessment', path: '/schemes', enabled: true },
  { id: 'reports', text: 'Reports', icon: 'Assessment', path: '/reports', enabled: true },
  { id: 'settings', text: 'Settings', icon: 'Settings', path: '/settings', enabled: true },
];

export const useNavigationCustomization = () => {
  const user = useSelector(selectAuthUser);
  const userId = user?.id || 'guest';
  const STORAGE_KEY = `pve_navigation_preferences_${userId}`;

  const [menuItems, setMenuItems] = useState<(MenuItem | MenuGroup)[]>(DEFAULT_MENU_ITEMS);
  const [isLoaded, setIsLoaded] = useState(false);


  // Load preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const validSavedItems = parsed.filter((item: any) =>
          DEFAULT_MENU_ITEMS.some(defaultItem => defaultItem.id === item.id)
        );

        if (validSavedItems.length > 0) {
          const merged = DEFAULT_MENU_ITEMS.map((defaultItem) => {
            const savedItem = validSavedItems.find((item: any) => item.id === (defaultItem as any).id);
            if (!savedItem) return defaultItem;

            if ('items' in defaultItem) {
              const defaultGroup = defaultItem as MenuGroup;
              const savedGroup = savedItem as MenuGroup;
              const mergedItems = (defaultGroup.items || []).map((sub) => {
                const savedSub = Array.isArray(savedGroup.items)
                  ? savedGroup.items.find((s: any) => s.id === sub.id)
                  : undefined;
                return savedSub ? { ...sub, ...savedSub } : sub;
              });
              return { ...defaultGroup, ...savedGroup, items: mergedItems };
            }

            return { ...defaultItem, ...savedItem };
          });
          setMenuItems(merged);
        } else {
          localStorage.removeItem(STORAGE_KEY);
          setMenuItems(DEFAULT_MENU_ITEMS);
        }
      } else {
        setMenuItems(DEFAULT_MENU_ITEMS);
      }
    } catch (error) {
      console.warn('Failed to load navigation preferences:', error);
      localStorage.removeItem(STORAGE_KEY);
      setMenuItems(DEFAULT_MENU_ITEMS);
    }
    setIsLoaded(true);
  }, [userId]);

  const savePreferences = (items: (MenuItem | MenuGroup)[]) => {
    try {
      const validItems = items.filter(item =>
        DEFAULT_MENU_ITEMS.some(defaultItem => defaultItem.id === item.id)
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validItems));
      setMenuItems(validItems);
    } catch (error) {
      console.warn('Failed to save navigation preferences:', error);
    }
  };

  const reorderMenuItems = (startIndex: number, endIndex: number) => {
    const result = Array.from(menuItems);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    savePreferences(result);
  };

  const toggleMenuItem = (id: string) => {
    const updated = menuItems.map(item =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    savePreferences(updated);
  };

  const resetToDefaults = () => {
    savePreferences(DEFAULT_MENU_ITEMS);
  };

  const getEnabledMenuItems = () => {
    return menuItems.filter(item => item.enabled);
  };

  return {
    menuItems,
    isLoaded,
    reorderMenuItems,
    toggleMenuItem,
    resetToDefaults,
    getEnabledMenuItems,
  };
};
