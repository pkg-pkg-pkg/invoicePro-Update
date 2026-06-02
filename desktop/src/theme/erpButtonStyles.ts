import { ERP_HEADER_BG, ERP_MENU_BG, ERP_SELECT } from './erpColors';

/** Solid ERP navy primary — avoids accent-gradient buttons that look black/grey. */
export const erpContainedButtonSx = {
  bgcolor: ERP_HEADER_BG,
  backgroundImage: 'none',
  color: '#fff',
  boxShadow: 'none',
  '&:hover': {
    bgcolor: ERP_MENU_BG,
    backgroundImage: 'none',
    color: '#fff',
    boxShadow: 'none',
  },
  '&.Mui-disabled': {
    bgcolor: 'rgba(27, 58, 107, 0.45)',
    color: 'rgba(255,255,255,0.7)',
  },
};

export const erpOutlinedButtonSx = {
  borderColor: ERP_HEADER_BG,
  color: ERP_HEADER_BG,
  bgcolor: '#fff',
  '&:hover': {
    borderColor: ERP_MENU_BG,
    color: ERP_MENU_BG,
    bgcolor: 'rgba(27, 58, 107, 0.06)',
  },
};

export const erpContainedHoverGoldSx = {
  ...erpContainedButtonSx,
  '&:hover': {
    bgcolor: ERP_SELECT,
    color: '#0f172a',
    backgroundImage: 'none',
  },
};
