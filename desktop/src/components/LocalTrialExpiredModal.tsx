import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { quitApplication } from '../utils/appQuit';

export default function LocalTrialExpiredModal() {
  const navigate = useNavigate();

  return (
    <Dialog open fullScreen disableEscapeKeyDown onClose={() => undefined}>
      <DialogContent>
        <Box
          sx={{
            minHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 2,
            px: 2,
          }}
        >
          <Typography variant="h4" fontWeight={800}>
            Trial Expired
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 420 }}>
            Your trial has expired. Please activate a license to continue.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 4, gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => {
            window.location.hash = '#/activate';
            navigate('/activate', { replace: true });
          }}
        >
          Activate License
        </Button>
        <Button variant="outlined" size="large" onClick={() => void quitApplication()}>
          Close App
        </Button>
      </DialogActions>
    </Dialog>
  );
}
