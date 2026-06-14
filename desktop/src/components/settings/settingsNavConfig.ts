import type { SvgIconComponent } from '@mui/icons-material';
import BusinessIcon from '@mui/icons-material/Business';
import SecurityIcon from '@mui/icons-material/Security';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import BackupIcon from '@mui/icons-material/Backup';
import LanIcon from '@mui/icons-material/Lan';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PeopleIcon from '@mui/icons-material/People';
import InfoIcon from '@mui/icons-material/Info';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import StorageIcon from '@mui/icons-material/Storage';
import InventoryIcon from '@mui/icons-material/Inventory2';

export type SettingsSectionId =
  | 'company'
  | 'voucher-numbers'
  | 'security'
  | 'privacy'
  | 'backup'
  | 'data-storage'
  | 'inventory'
  | 'network'
  | 'whatsapp'
  | 'gst-eway'
  | 'users'
  | 'about';

export interface SettingsNavItem {
  id: SettingsSectionId;
  label: string;
  icon: SvgIconComponent;
  emoji: string;
  keywords: string[];
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    id: 'company',
    label: 'Company',
    icon: BusinessIcon,
    emoji: '🏢',
    keywords: ['company', 'profile', 'gstin', 'logo', 'business', 'switch', 'create'],
  },
  {
    id: 'voucher-numbers',
    label: 'Voucher Numbers',
    icon: ReceiptLongIcon,
    emoji: '🔢',
    keywords: ['voucher', 'number', 'prefix', 'sequence', 'invoice', 'format', 'sales', 'purchase'],
  },
  {
    id: 'security',
    label: 'Security',
    icon: SecurityIcon,
    emoji: '🔒',
    keywords: ['security', 'password', 'session', 'login', 'logout', 'timeout'],
  },
  {
    id: 'privacy',
    label: 'Privacy & Diagnostics',
    icon: PrivacyTipIcon,
    emoji: '🛡️',
    keywords: ['privacy', 'diagnostics', 'feedback', 'crash', 'analytics', 'telemetry', 'improvement'],
  },
  {
    id: 'backup',
    label: 'Backup & Restore',
    icon: BackupIcon,
    emoji: '💾',
    keywords: ['backup', 'restore', 'snapshot', 'folder', 'auto backup'],
  },
  {
    id: 'data-storage',
    label: 'Data Storage',
    icon: StorageIcon,
    emoji: '🗄️',
    keywords: ['data', 'storage', 'database', 'path', 'folder', 'location', 'appdata', 'custom', 'install'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: InventoryIcon,
    emoji: '📦',
    keywords: ['inventory', 'stock', 'barcode', 'low stock', 'reorder', 'threshold'],
  },
  {
    id: 'network',
    label: 'Network & Multi User',
    icon: LanIcon,
    emoji: '🌐',
    keywords: ['network', 'lan', 'multi user', 'server', 'client', 'host', 'gateway'],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: WhatsAppIcon,
    emoji: '📱',
    keywords: ['whatsapp', 'message', 'reminder', 'invoice share'],
  },
  {
    id: 'gst-eway',
    label: 'GST & E-Way Bill',
    icon: LocalShippingIcon,
    emoji: '🚚',
    keywords: ['gst', 'e-way', 'eway', 'transport', 'threshold', 'gsp'],
  },
  {
    id: 'users',
    label: 'User Management',
    icon: PeopleIcon,
    emoji: '👥',
    keywords: ['user', 'role', 'permission', 'staff', 'admin'],
  },
  {
    id: 'about',
    label: 'About & Updates',
    icon: InfoIcon,
    emoji: 'ℹ️',
    keywords: ['about', 'update', 'version', 'system information', 'support'],
  },
];

export function filterSettingsNav(query: string): SettingsNavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SETTINGS_NAV_ITEMS;
  return SETTINGS_NAV_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q) || q.includes(k))
  );
}

export function sectionLabel(id: SettingsSectionId): string {
  return SETTINGS_NAV_ITEMS.find((i) => i.id === id)?.label ?? 'Settings';
}
