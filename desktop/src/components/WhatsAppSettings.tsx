import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Alert,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import {
  WhatsApp as WhatsAppIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  getWhatsAppConnectionStatus,
  refreshWhatsAppConnectionStatus,
} from '../services/whatsappIntegration';
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  loadWhatsAppMessageTemplates,
  saveWhatsAppMessageTemplates,
  type WhatsAppMessageTemplates,
} from '../services/whatsappMessageTemplates';

const TEMPLATE_FIELDS: Array<{
  key: keyof WhatsAppMessageTemplates;
  label: string;
  helper: string;
}> = [
  {
    key: 'invoice',
    label: 'Invoice share message',
    helper: 'Placeholders: {{customerName}}, {{documentType}}, {{invoiceNumber}}, {{invoiceDate}}, {{amount}}, {{paymentLink}}, {{pdfNote}}, {{outstandingAmount}}, {{companyName}}',
  },
  {
    key: 'paymentReminder',
    label: 'Payment reminder',
    helper: 'Placeholders: {{customerName}}, {{outstandingAmount}}, {{dueDate}}, {{companyName}}',
  },
  {
    key: 'outstanding',
    label: 'Outstanding balance',
    helper: 'Placeholders: {{customerName}}, {{outstandingAmount}}, {{companyName}}',
  },
];

export default function WhatsAppSettings() {
  const [templates, setTemplates] = useState<WhatsAppMessageTemplates>(() =>
    loadWhatsAppMessageTemplates()
  );
  const [status, setStatus] = useState(getWhatsAppConnectionStatus());
  const [saveStatus, setSaveStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void refreshWhatsAppConnectionStatus().then(setStatus);
  }, []);

  const handleSave = () => {
    saveWhatsAppMessageTemplates(templates);
    setSaveStatus('Message templates saved.');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const handleReset = () => {
    setTemplates({ ...DEFAULT_WHATSAPP_TEMPLATES });
  };

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    try {
      setStatus(await refreshWhatsAppConnectionStatus());
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <WhatsAppIcon sx={{ fontSize: 32, color: '#25D366' }} />
        <Box>
          <Typography variant="h5" fontWeight={800}>
            WhatsApp Sharing
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Share invoices with PDF note, UPI payment link, and outstanding balance via WhatsApp Desktop or Web.
          </Typography>
        </Box>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Messages open in WhatsApp Desktop when installed, otherwise WhatsApp Web. You confirm and send — nothing is sent automatically.
      </Alert>

      {saveStatus && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveStatus('')}>
          {saveStatus}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">Connection</Typography>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => void handleRefreshStatus()}
            disabled={refreshing}
          >
            Refresh
          </Button>
        </Stack>
        <Chip
          label={status.ok ? `Connected (${status.mode})` : status.status}
          color={status.ok ? 'success' : 'default'}
          sx={{ mb: 1 }}
        />
        <Typography variant="body2" color="text.secondary">
          Install WhatsApp Desktop for the best experience, or allow the app to open WhatsApp Web.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Editable message templates
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Use placeholders in double curly braces. Conditional blocks: {'{{#if paymentLink}}'}…{'{{/if}}'}
        </Typography>

        <Grid container spacing={3}>
          {TEMPLATE_FIELDS.map((field) => (
            <Grid item xs={12} key={field.key}>
              <TextField
                fullWidth
                multiline
                minRows={6}
                label={field.label}
                value={templates[field.key]}
                onChange={(e) =>
                  setTemplates((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                helperText={field.helper}
              />
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Stack direction="row" spacing={2}>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
            Save templates
          </Button>
          <Button variant="outlined" onClick={handleReset}>
            Reset to defaults
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
