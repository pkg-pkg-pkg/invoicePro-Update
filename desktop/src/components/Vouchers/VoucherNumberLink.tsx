import { Link as MuiLink, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { VoucherType } from '../../types/vouchers';
import { getVoucherEditPathById, resolveVoucherNumberLabel } from '../../utils/voucherNavigation';

type Props = {
  voucherId: string;
  voucherType: string | VoucherType;
  voucherNumber?: string | null;
  fontWeight?: number | string;
  onClick?: () => void;
};

export function VoucherNumberLink({
  voucherId,
  voucherType,
  voucherNumber,
  fontWeight = 600,
  onClick,
}: Props) {
  const navigate = useNavigate();
  const label = resolveVoucherNumberLabel(voucherNumber, voucherId);
  const path = getVoucherEditPathById(voucherId, voucherType);

  if (!path || label === '—') {
    return (
      <Typography variant="body2" component="span" sx={{ fontWeight }}>
        {label}
      </Typography>
    );
  }

  return (
    <MuiLink
      component="button"
      type="button"
      variant="body2"
      underline="hover"
      sx={{ fontWeight, textAlign: 'inherit' }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
        navigate(path);
      }}
    >
      {label}
    </MuiLink>
  );
}
