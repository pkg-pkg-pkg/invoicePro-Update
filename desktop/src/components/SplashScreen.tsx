import React from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import Logo from './Logo';

interface SplashScreenProps {
  message?: string;
}

const SplashScreen: React.FC<SplashScreenProps> = ({
  message = "Loading InvoicePro..."
}) => {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <Paper
        elevation={24}
        sx={{
          p: 4,
          borderRadius: 4,
          textAlign: 'center',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          minWidth: 400,
        }}
      >
        <Logo size="large" />

        <Typography
          variant="h4"
          sx={{
            mt: 3,
            mb: 2,
            fontWeight: 600,
            color: '#b8860b',
            textAlign: 'center'
          }}
        >
          InvoicePro
        </Typography>

        <Typography
          variant="body1"
          sx={{
            mb: 3,
            color: 'text.secondary',
            textAlign: 'center'
          }}
        >
          Professional Invoice & Billing Management
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <CircularProgress
            size={40}
            sx={{
              color: '#b8860b',
            }}
          />
        </Box>

        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
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
