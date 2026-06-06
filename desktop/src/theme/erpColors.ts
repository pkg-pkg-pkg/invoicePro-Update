import { LIGHT_THEME } from './lightTheme';
import { DARK_THEME } from './darkTheme';
import type { UiMode } from './appearanceSettings';

export interface ErpChromeColors {
  headerBg: string;
  headerText: string;
  headerBorder: string;
  menuBg: string;
  menuText: string;
  menuActive: string;
  menuHover: string;
  select: string;
  workspaceBg: string;
  text: string;
  toolbarBg: string;
  toolbarBorder: string;
  statusBarBg: string;
  menuDropdownBg: string;
  menuDropdownHover: string;
  userGroupBg: string;
  userGroupBorder: string;
}

export function getErpChromeColors(mode: UiMode): ErpChromeColors {
  const isDark = mode === 'premium-dark';
  if (isDark) {
    return {
      headerBg: DARK_THEME.background.header,
      headerText: DARK_THEME.text.primary,
      headerBorder: DARK_THEME.border,
      menuBg: DARK_THEME.background.sidebar,
      menuText: DARK_THEME.text.primary,
      menuActive: DARK_THEME.primary,
      menuHover: 'rgba(255, 255, 255, 0.06)',
      select: DARK_THEME.gold,
      workspaceBg: DARK_THEME.background.default,
      text: DARK_THEME.text.primary,
      toolbarBg: DARK_THEME.background.paper,
      toolbarBorder: DARK_THEME.border,
      statusBarBg: DARK_THEME.background.paper,
      menuDropdownBg: DARK_THEME.background.card,
      menuDropdownHover: 'rgba(255, 255, 255, 0.04)',
      userGroupBg: 'rgba(255, 255, 255, 0.04)',
      userGroupBorder: DARK_THEME.border,
    };
  }
  return {
    headerBg: LIGHT_THEME.background.header,
    headerText: LIGHT_THEME.text.primary,
    headerBorder: LIGHT_THEME.border,
    menuBg: LIGHT_THEME.background.sidebar,
    menuText: '#FFFFFF',
    menuActive: LIGHT_THEME.primary,
    menuHover: 'rgba(255,255,255,0.1)',
    select: LIGHT_THEME.gold,
    workspaceBg: LIGHT_THEME.background.content,
    text: LIGHT_THEME.text.primary,
    toolbarBg: LIGHT_THEME.background.elevated,
    toolbarBorder: LIGHT_THEME.border,
    statusBarBg: LIGHT_THEME.background.paper,
    menuDropdownBg: LIGHT_THEME.background.paper,
    menuDropdownHover: LIGHT_THEME.primarySoft,
    userGroupBg: 'rgba(15, 23, 42, 0.04)',
    userGroupBorder: LIGHT_THEME.border,
  };
}

/** @deprecated Use getErpChromeColors(mode) */
export const ERP_HEADER_BG = LIGHT_THEME.background.sidebar;
export const ERP_MENU_BG = LIGHT_THEME.background.sidebar;
export const ERP_SELECT = LIGHT_THEME.gold;
export const ERP_WORKSPACE_BG = LIGHT_THEME.background.content;
export const ERP_TEXT = LIGHT_THEME.text.primary;
