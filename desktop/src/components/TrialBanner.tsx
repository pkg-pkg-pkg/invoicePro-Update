import { useEffect, useState } from 'react';
import { Alert, Button, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import {
  dismissTrialBanner,
  getTrialStartDate,
  isTrialBannerDismissed,
  trialDaysRemaining,
} from '../services/localTrialService';

export default function TrialBanner() {
  const navigate = useNavigate();
  const [days, setDays] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(isTrialBannerDismissed);

  useEffect(() => {
    void (async () => {
      const start = await getTrialStartDate();
      if (start != null) setDays(trialDaysRemaining(start));
    })();
  }, []);

  if (dismissed || days == null) return null;

  const handleDismiss = () => {
    dismissTrialBanner();
    setDismissed(true);
  };

  return (
    <Alert
      severity="warning"
      icon={false}
      sx={{
        borderRadius: 0,
        py: 0.75,
        '& .MuiAlert-message': { width: '100%' },
      }}
      action={
        <IconButton size="small" aria-label="Dismiss trial notice" onClick={handleDismiss}>
          <CloseIcon fontSize="small" />
        </IconButton>
      }
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Typography variant="body2" fontWeight={600}>
          You are using a 7-day free trial. Activate a license to unlock full access.
          {days > 0 ? ` (${days} day${days === 1 ? '' : 's'} left)` : ''}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={() => navigate('/activate')}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Activate License
        </Button>
      </Stack>
    </Alert>
  );
}
