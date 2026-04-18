import React from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Logo from './Logo';
import { APP_DISPLAY_NAME } from '@/constants/appBranding';
import { authPaperSx } from '../theme/authScreenChrome';

interface SplashScreenProps {
  message?: string;
}

const SplashScreen: React.FC<SplashScreenProps> = ({
  message = `Loading ${APP_DISPLAY_NAME}...`
}) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: `
          radial-gradient(1100px 520px at 78% 12%, rgba(77, 196, 255, 0.34), rgba(77, 196, 255, 0) 62%),
          radial-gradient(900px 420px at 18% 88%, rgba(61, 217, 116, 0.30), rgba(61, 217, 116, 0) 62%),
          linear-gradient(140deg, #07356e 0%, #0b4ea2 34%, #0e6ed8 64%, #16a078 100%)
        `,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.02) 46%, rgba(0,0,0,0.18) 100%)',
          pointerEvents: 'none',
        }}
      />
      <Paper
        elevation={24}
        sx={{
          ...authPaperSx(theme),
          borderRadius: 5,
          textAlign: 'center',
          minWidth: 420,
          maxWidth: 520,
          px: 5,
          py: 4.5,
          border: '1px solid rgba(255,255,255,0.46)',
          boxShadow: '0 28px 70px rgba(2, 16, 45, 0.48)',
          backdropFilter: 'blur(4px)',
          background:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(165deg, rgba(9,23,46,0.90), rgba(13,36,67,0.80))'
              : 'linear-gradient(165deg, rgba(255,255,255,0.95), rgba(247,251,255,0.88))',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Logo size="xl" />
        </Box>

        <Typography
          variant="h4"
          sx={{
            mt: 2.25,
            mb: 1,
            fontWeight: 700,
            letterSpacing: 0.2,
            color: theme.palette.mode === 'dark' ? '#dff2ff' : '#0e3567',
            textAlign: 'center'
          }}
        >
          {APP_DISPLAY_NAME}
        </Typography>

        <Typography
          variant="body1"
          sx={{
            mb: 3.25,
            color: theme.palette.mode === 'dark' ? 'rgba(225,236,255,0.80)' : 'rgba(14,53,103,0.74)',
            textAlign: 'center'
          }}
        >
          Professional Invoice & Billing Management
        </Typography>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: 1.5,
            py: 1,
            borderRadius: 2,
            background:
              theme.palette.mode === 'dark'
                ? 'rgba(94, 153, 255, 0.10)'
                : 'rgba(21, 99, 224, 0.09)',
          }}
        >
          <CircularProgress
            size={34}
            thickness={4.2}
            sx={{ color: theme.palette.mode === 'dark' ? '#7bd7ff' : '#1164dd' }}
          />
        </Box>

        <Typography
          variant="body2"
          sx={{
            color: theme.palette.mode === 'dark' ? 'rgba(225,236,255,0.76)' : 'rgba(14,53,103,0.70)',
            textAlign: 'center'
          }}
        >
          {message}
        </Typography>
      </Paper>
    </Box>
  );
};

export default SplashScreen;
