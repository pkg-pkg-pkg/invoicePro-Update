import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { alpha } from '@mui/material/styles';
import { formatCurrency } from '../../utils/formatters';
import { openWhatsAppChat } from '../../services/whatsappIntegration';

export interface WhatsAppReminderPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
  mobile: string;
  outstandingAmount: number;
  initialMessage: string;
  title?: string;
  amountLabel?: string;
  onLaunchError?: (message: string) => void;
  onLaunchSuccess?: () => void;
}

export function WhatsAppReminderPreviewDialog({
  open,
  onClose,
  customerName,
  mobile,
  outstandingAmount,
  initialMessage,
  title = 'WhatsApp Reminder Preview',
  amountLabel = 'Outstanding Amount',
  onLaunchError,
  onLaunchSuccess,
}: WhatsAppReminderPreviewDialogProps) {
  const [message, setMessage] = useState(initialMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMessage(initialMessage);
      setError(null);
      setSending(false);
    }
  }, [open, initialMessage]);

  const handleSend = async () => {
    setError(null);
    setSending(true);
    try {
      const result = await openWhatsAppChat(mobile, message);
      if (!result.ok) {
        const msg =
          result.error ||
          'WhatsApp is not available. Install WhatsApp Desktop or sign in to WhatsApp Web in your browser.';
        setError(msg);
        onLaunchError?.(msg);
        return;
      }
      onLaunchSuccess?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open WhatsApp.';
      setError(msg);
      onLaunchError?.(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={sending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Review the reminder below. WhatsApp will open with this message pre-filled — you must tap{' '}
            <strong>Send</strong> in WhatsApp manually. This app never auto-sends messages.
          </Typography>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.06 : 0.03),
            }}
          >
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Customer Name
                </Typography>
                <Typography fontWeight={700}>{customerName}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Mobile Number
                </Typography>
                <Typography fontWeight={700} sx={{ fontFeatureSettings: '"tnum"' }}>
                  {mobile}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {amountLabel}
                </Typography>
                <Typography fontWeight={800} color="warning.main">
                  {formatCurrency(outstandingAmount)}
                </Typography>
              </Stack>
            </Stack>
          </Box>

          <TextField
            label="Message Preview"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            multiline
            minRows={8}
            maxRows={14}
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="You can edit the message before opening WhatsApp."
          />

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={sending} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={<WhatsAppIcon />}
          onClick={() => void handleSend()}
          disabled={sending || !message.trim() || !mobile.trim()}
          sx={{ textTransform: 'none', fontWeight: 700, minWidth: 180 }}
        >
          {sending ? 'Opening WhatsApp…' : 'Send on WhatsApp'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
