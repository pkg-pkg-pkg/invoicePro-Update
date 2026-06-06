import { Box } from '@mui/material';

import { APP_LOGO_URL } from '../constants/appLogo';

type LogoProps = {
  size?: 'small' | 'auth' | 'toolbar';
  alt?: string;
};

/** InvoicePro Admin mark is wider than tall — keep aspect ratio. */
const SIZES = {
  small: { width: 36, height: 36 },
  toolbar: { width: 132, height: 36 },
  auth: { width: 280, height: 96 },
} as const;

export default function Logo({ size = 'toolbar', alt = 'InvoicePro Admin' }: LogoProps) {
  const dim = SIZES[size];
  return (
    <Box
      component="img"
      src={APP_LOGO_URL}
      alt={alt}
      sx={{
        width: dim.width,
        height: dim.height,
        maxWidth: '100%',
        objectFit: 'contain',
        objectPosition: 'left center',
        display: 'block',
        flexShrink: 0,
      }}
    />
  );
}
