import type { SxProps, Theme } from '@mui/material/styles';

/** Shared min-widths for numeric columns in voucher / pipeline line-item tables. */
export const VOUCHER_LINE_COLUMN_WIDTH = {
  index: 44,
  item: 200,
  qty: 72,
  unit: 72,
  mrp: 96,
  rate: 120,
  discPercent: 72,
  discAmount: 96,
  gstPercent: 72,
  amount: 120,
  godown: 132,
  delete: 56,
} as const;

export type VoucherLineColumnKey = keyof typeof VOUCHER_LINE_COLUMN_WIDTH;

const PERCENT_COLUMNS = new Set<VoucherLineColumnKey>(['qty', 'discPercent', 'gstPercent']);

const RIGHT_ALIGNED_COLUMNS = new Set<VoucherLineColumnKey>(['mrp', 'rate', 'discAmount', 'amount']);

/** Scrollable wrapper with subtle border — use around line-item tables. */
export const voucherLineTableContainerSx: SxProps<Theme> = {
  overflowX: 'auto',
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
};

/** Table-level styling: header band, row height, zebra striping. */
export const voucherLineTableSx: SxProps<Theme> = {
  minWidth: 1366,
  '& .MuiTableCell-head': {
    fontWeight: 700,
    fontSize: '0.8125rem',
    letterSpacing: '0.02em',
    color: 'text.secondary',
    bgcolor: 'grey.50',
    borderBottom: '2px solid',
    borderColor: 'divider',
    py: 1.25,
    whiteSpace: 'nowrap',
  },
  '& tbody .MuiTableRow-root:nth-of-type(even)': {
    bgcolor: 'grey.50',
  },
  '& tbody .MuiTableCell-root': {
    py: 1.25,
    verticalAlign: 'middle',
    borderBottom: '1px solid',
    borderColor: 'divider',
  },
};

/** TableCell sizing for a line-item column. */
export function voucherLineCellSx(
  column: VoucherLineColumnKey,
  align?: 'left' | 'center' | 'right'
): SxProps<Theme> {
  const width = VOUCHER_LINE_COLUMN_WIDTH[column];
  const textAlign =
    align ?? (PERCENT_COLUMNS.has(column) ? 'center' : RIGHT_ALIGNED_COLUMNS.has(column) ? 'right' : 'left');
  return { minWidth: width, width, textAlign, whiteSpace: 'nowrap' };
}

const editableInputRoot: SxProps<Theme> = {
  fontSize: '0.875rem',
  minHeight: 42,
  borderRadius: '8px',
  bgcolor: 'background.paper',
  '& fieldset': {
    borderColor: '#D1D5DB',
  },
  '&:hover fieldset': {
    borderColor: '#9CA3AF',
  },
  '&.Mui-focused fieldset': {
    borderColor: 'primary.main',
    borderWidth: 2,
  },
};

const editableInputInner: SxProps<Theme> = {
  px: 1.25,
  py: 1,
  fontSize: '0.875rem',
  fontVariantNumeric: 'tabular-nums',
};

const numericInputBase: SxProps<Theme> = {
  width: '100%',
  '& .MuiInputBase-root': editableInputRoot,
  '& .MuiInputBase-input': editableInputInner,
  '& input[type=number]': {
    MozAppearance: 'textfield',
  },
  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
    WebkitAppearance: 'none',
    margin: 0,
  },
};

/** Right-aligned numeric input (rates, amounts). */
export const voucherLineNumericInputSx: SxProps<Theme> = {
  ...numericInputBase,
  '& .MuiInputBase-input': {
    ...editableInputInner,
    textAlign: 'right',
  },
};

/** Center-aligned percent / qty inputs (Disc %, GST %, Qty). */
export const voucherLinePercentInputSx: SxProps<Theme> = {
  ...numericInputBase,
  '& .MuiInputBase-input': {
    ...editableInputInner,
    textAlign: 'center',
  },
};

/** Item name picker field in line rows. */
export const voucherLineItemFieldSx: SxProps<Theme> = {
  width: '100%',
  '& .MuiInputBase-root': editableInputRoot,
  '& .MuiInputBase-input': {
    ...editableInputInner,
    cursor: 'pointer',
  },
};

/** Godown / select fields in line rows. */
export const voucherLineSelectSx: SxProps<Theme> = {
  width: '100%',
  '& .MuiInputBase-root': editableInputRoot,
  '& .MuiSelect-select': {
    ...editableInputInner,
    display: 'flex',
    alignItems: 'center',
  },
};

/** Calculated amount column (read-only display). */
export const voucherLineAmountDisplaySx: SxProps<Theme> = {
  display: 'inline-block',
  minWidth: 88,
  px: 1.25,
  py: 1,
  borderRadius: '8px',
  bgcolor: 'grey.100',
  border: '1px solid',
  borderColor: 'grey.300',
  fontSize: '0.875rem',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
};

/** Fixed-width field for pipeline tables that do not use full-width cells. */
export function voucherLineCompactFieldSx(
  column: VoucherLineColumnKey,
  kind: 'percent' | 'numeric' = 'numeric'
): SxProps<Theme> {
  const width = VOUCHER_LINE_COLUMN_WIDTH[column];
  const base = kind === 'percent' ? voucherLinePercentInputSx : voucherLineNumericInputSx;
  return {
    ...base,
    minWidth: width,
    width,
    maxWidth: width,
  };
}
