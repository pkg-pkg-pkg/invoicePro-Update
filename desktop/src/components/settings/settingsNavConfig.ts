import type { SvgIconComponent } from '@mui/icons-material';
import BusinessIcon from '@mui/icons-material/Business';
import SecurityIcon from '@mui/icons-material/Security';
import BackupIcon from '@mui/icons-material/Backup';
import LanIcon from '@mui/icons-material/Lan';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PrintIcon from '@mui/icons-material/Print';
import PeopleIcon from '@mui/icons-material/People';
import InfoIcon from '@mui/icons-material/Info';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import StorageIcon from '@mui/icons-material/Storage';

export type SettingsSectionId =
  | 'company'
  | 'security'
  | 'backup'
  | 'data-storage'
  | 'network'
  | 'whatsapp'
  | 'print'
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
    id: 'security',
    label: 'Security',
    icon: SecurityIcon,
    emoji: '🔒',
    keywords: ['security', 'password', 'session', 'login', 'logout', 'timeout'],
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
    id: 'print',
    label: 'Print Setup',
    icon: PrintIcon,
    emoji: '🖨️',
    keywords: ['print', 'printer', 'invoice template', 'thermal', 'paper'],
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
