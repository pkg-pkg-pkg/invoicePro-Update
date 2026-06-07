import { Chip } from '@mui/material';
import type { VoucherEwayBill } from '../../types/ewayBill';
import { getEwayListDisplay, getEwayStatusLabel } from '../../services/ewayBillService';

type Props = {
  eway?: VoucherEwayBill | null;
  compact?: boolean;
};

export function EwayBillStatusChip({ eway, compact = false }: Props) {
  const status = eway?.status ?? 'NOT_REQUIRED';
  const label = compact ? getEwayStatusLabel(status) : getEwayListDisplay(eway);

  const color =
    status === 'GENERATED' || status === 'MANUAL'
      ? 'success'
      : status === 'PENDING'
        ? 'warning'
        : 'default';

  return (
    <Chip
      size="small"
      label={label}
      color={color}
      variant={status === 'NOT_REQUIRED' ? 'outlined' : 'filled'}
      sx={{ fontWeight: 700, maxWidth: compact ? 120 : 180 }}
    />
  );
}
