import { Box } from '@mui/material';

import { APP_LOGO_URL } from '../constants/appLogo';

type LogoProps = {
  size?: 'small' | 'auth' | 'toolbar';
  alt?: string;
};

const SIZES = {
  small: 32,
  auth: 88,
  toolbar: 36,
} as const;

export default function Logo({ size = 'toolbar', alt = 'InvoicePro Admin' }: LogoProps) {
  const px = SIZES[size];
  return (
    <Box
      component="img"
      src={APP_LOGO_URL}
      alt={alt}
      sx={{
        width: px,
        height: px,
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
      }}
    />
  );
}
