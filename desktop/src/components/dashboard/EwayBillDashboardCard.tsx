import { useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { useNavigate } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import { computeEwayBillDashboardStats } from '../../services/ewayBillService';
import { useDashboardTheme } from './dashboardTheme';

export function EwayBillDashboardCard() {
  const navigate = useNavigate();
  const dt = useDashboardTheme();
  const [stats, setStats] = useState({ pending: 0, generated: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void computeEwayBillDashboardStats()
      .then((data) => {
        if (mounted) setStats(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Box
      component="button"
      type="button"
      onClick={() => navigate('/gst/e-way-bill')}
      sx={{
        border: '1px solid',
        borderColor: alpha('#2563EB', 0.14),
        borderRadius: dt.cardRadius,
        bgcolor: alpha('#2563EB', 0.04),
        p: 2,
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        transition: dt.transition,
        '&:hover': {
          borderColor: alpha('#2563EB', 0.35),
          transform: dt.hoverLift,
          boxShadow: dt.cardShadow,
        },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha('#2563EB', 0.12),
            color: '#2563EB',
          }}
        >
          <LocalShippingIcon />
        </Box>
        <Typography variant="subtitle1" fontWeight={800}>
          E-Way Bills
        </Typography>
      </Stack>
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <Stack spacing={0.5}>
          <Typography variant="body2">
            Pending: <strong>{stats.pending}</strong>
          </Typography>
          <Typography variant="body2">
            Generated: <strong>{stats.generated}</strong>
          </Typography>
          <Typography variant="body2">
            This Month: <strong>{stats.thisMonth}</strong>
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
