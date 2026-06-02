import React from 'react';
import { Box } from '@mui/material';
import { APP_DISPLAY_NAME } from '../constants/appBranding';
import { APP_LOGO_URL } from '../constants/appLogo';

interface LogoProps {
  size?: 'small' | 'auth' | 'medium' | 'large' | 'xl';
  className?: string;
  onClick?: () => void;
}

const Logo: React.FC<LogoProps> = ({ size = 'medium', className = '', onClick }) => {
  const getSize = () => {
    switch (size) {
      case 'small': return { width: 40, height: 40 };
      case 'auth': return { width: 80, height: 80 };
      case 'medium': return { width: 120, height: 120 };
      case 'large': return { width: 300, height: 300 };
      case 'xl': return { width: 256, height: 256 };
      default: return { width: 120, height: 120 };
    }
  };

  const { width, height } = getSize();

  return (
    <Box
      component="img"
      src={APP_LOGO_URL}
      alt={`${APP_DISPLAY_NAME} logo`}
      sx={{
        width: width,
        height: height,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease-in-out',
        '&:hover': {
          transform: onClick ? 'scale(1.05)' : 'none',
        },
      }}
      className={className}
      onClick={onClick}
    />
  );
};

export default Logo;
