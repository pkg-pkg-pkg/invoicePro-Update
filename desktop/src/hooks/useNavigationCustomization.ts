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
      { id: 'parties', text: 'Party Master', icon: 'Person', path: '/parties', enabled: true },
      {
        id: 'party-ledger-report',
        text: 'Party Ledger',
        icon: 'MenuBook',
        path: '/parties/ledger-report',
        enabled: true,
      },
      {
        id: 'import-from-erp',
        text: 'Upload from Tally/Busy/Marg',
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
  /** Party payments / receipts: use Vouchers → Payment Vouchers. Standalone /payments route kept for bookmarks only. */
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
        // Only load preferences for items that are currently in DEFAULT_MENU_ITEMS
        // This prevents old/deprecated menu items from being loaded
        const validSavedItems = parsed.filter((item: any) =>
          DEFAULT_MENU_ITEMS.some(defaultItem => defaultItem.id === item.id)
        );

        if (validSavedItems.length > 0) {
          const merged = DEFAULT_MENU_ITEMS.map((defaultItem) => {
            const savedItem = validSavedItems.find((item: any) => item.id === (defaultItem as any).id);
            if (!savedItem) return defaultItem;

            // Deep-merge groups so new submenu items are not lost.
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
          // If no valid saved items, clear localStorage and use defaults
          localStorage.removeItem(STORAGE_KEY);
          setMenuItems(DEFAULT_MENU_ITEMS);
        }
      } else {
        // If no saved preferences for this user, start with defaults
        setMenuItems(DEFAULT_MENU_ITEMS);
      }
    } catch (error) {
      console.warn('Failed to load navigation preferences:', error);
      // Clear potentially corrupted localStorage data
      localStorage.removeItem(STORAGE_KEY);
      setMenuItems(DEFAULT_MENU_ITEMS);
    }
    setIsLoaded(true);
  }, [userId]); // Reload when user changes

  // Save preferences to localStorage
  const savePreferences = (items: (MenuItem | MenuGroup)[]) => {
    try {
      // Only save preferences for items that are currently in DEFAULT_MENU_ITEMS
      // This prevents deprecated menu items from being persisted
      const validItems = items.filter(item =>
        DEFAULT_MENU_ITEMS.some(defaultItem => defaultItem.id === item.id)
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validItems));
      setMenuItems(validItems);
    } catch (error) {
      console.warn('Failed to save navigation preferences:', error);
    }
  };

  // Reorder menu items
  const reorderMenuItems = (startIndex: number, endIndex: number) => {
    const result = Array.from(menuItems);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    savePreferences(result);
  };

  // Toggle menu item visibility
  const toggleMenuItem = (id: string) => {
    const updated = menuItems.map(item =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    savePreferences(updated);
  };

  // Reset to defaults
  const resetToDefaults = () => {
    savePreferences(DEFAULT_MENU_ITEMS);
  };

  // Get enabled menu items in order
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
