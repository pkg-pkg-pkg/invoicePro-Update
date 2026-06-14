import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  Typography,
} from '@mui/material';
import { TRIAL_PURCHASE_URL, TRIAL_SUPPORT_WHATSAPP } from '../../constants/trialCredentials';
import { maskMobile } from '../../services/trialService';
import { isElectronRuntime } from '../../utils/runtime';

type Props = {
  reason: 'EXPIRED' | 'DEVICE_BLOCKED' | 'MOBILE_BLOCKED';
  mobileNo?: string;
  endDate?: number | null;
  onCloseApp?: () => void;
};

const MESSAGES: Record<Props['reason'], string> = {
  EXPIRED:
    'Your 7-day free trial has ended. Thank you for trying our app! Purchase a license to continue.',
  DEVICE_BLOCKED:
    'A free trial was already used on this device. Each device gets one trial only.',
  MOBILE_BLOCKED: 'Trial period is over for this mobile number. Please buy a license.',
};

export default function TrialExpiredScreen({ reason, mobileNo, endDate, onCloseApp }: Props) {
  const openUrl = (url: string) => {
    if (isElectronRuntime() && window.electronAPI?.openExternalUrl) {
      void window.electronAPI.openExternalUrl(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const quit = () => {
    if (onCloseApp) {
      onCloseApp();
      return;
    }
    if (isElectronRuntime() && window.electronAPI?.windowClose) {
      void window.electronAPI.windowClose();
    } else {
      window.close();
    }
  };

  return (
    <Dialog open fullScreen disableEscapeKeyDown onClose={() => undefined}>
      <DialogContent>
        <Stack spacing={3} alignItems="center" justifyContent="center" sx={{ minHeight: '70vh', textAlign: 'center' }}>
          <Typography variant="h4" fontWeight={800}>
            🔒 PVE InvoicePro 360
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 420 }}>
            {MESSAGES[reason]}
          </Typography>
          {mobileNo ? (
            <Typography variant="body2">
              Mobile: +91 {maskMobile(mobileNo)}
            </Typography>
          ) : null}
          {endDate ? (
            <Typography variant="body2">
              Trial ended: {new Date(endDate).toLocaleDateString()}
            </Typography>
          ) : null}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%', maxWidth: 280 }}>
            <Button variant="contained" onClick={() => openUrl(TRIAL_PURCHASE_URL)}>
              🛒 Buy License Now
            </Button>
            <Button variant="outlined" onClick={() => openUrl(`https://wa.me/${TRIAL_SUPPORT_WHATSAPP}`)}>
              📞 WhatsApp Support
            </Button>
            <Button color="inherit" onClick={quit}>
              ❌ Close App
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions />
    </Dialog>
  );
}
