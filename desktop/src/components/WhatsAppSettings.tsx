// src/components/WhatsAppSettings.tsx
import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Alert,
  Switch,
  FormControlLabel,
  CircularProgress,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  WhatsApp as WhatsAppIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { whatsAppService, type WhatsAppSettings } from '../services/whatsappService';

export default function WhatsAppSettings() {
  const [settings, setSettings] = useState<WhatsAppSettings>({
    apiKey: '',
    phoneNumber: '',
    isEnabled: false,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');

  useEffect(() => {
    // Load existing settings
    const savedSettings = whatsAppService.loadSettings();
    if (savedSettings) {
      setSettings(savedSettings);
    }
  }, []);

  const handleSave = () => {
    try {
      whatsAppService.saveSettings(settings);
      whatsAppService.initialize(settings);
      setSaveStatus('Settings saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      setSaveStatus('Error saving settings');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const success = await whatsAppService.testConnection();
      setTestResult({
        success,
        message: success ? 'WhatsApp connection successful!' : 'Connection failed. Please check your settings.',
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Connection test failed.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleChange = (field: keyof WhatsAppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const isConfigured = settings.apiKey && settings.phoneNumber && settings.isEnabled;

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <WhatsAppIcon sx={{ fontSize: 32, color: '#25D366' }} />
        <Typography variant="h4">
          WhatsApp Integration Settings
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Configure WhatsApp Business API to send invoices and payment reminders directly to customers.
      </Alert>

      {saveStatus && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSaveStatus('')}>
          {saveStatus}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Configuration Card */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              API Configuration
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.isEnabled}
                      onChange={(e) => handleChange('isEnabled', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Enable WhatsApp Integration"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="WhatsApp Business API Key"
                  value={settings.apiKey}
                  onChange={(e) => handleChange('apiKey', e.target.value)}
                  disabled={!settings.isEnabled}
                  helperText="Enter your WhatsApp Business API key"
                  type="password"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Business Phone Number"
                  value={settings.phoneNumber}
                  onChange={(e) => handleChange('phoneNumber', e.target.value)}
                  disabled={!settings.isEnabled}
                  helperText="Enter your business WhatsApp number with country code (e.g., +919876543210)"
                  placeholder="+91XXXXXXXXXX"
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={false}
                  >
                    Save Settings
                  </Button>

                  <Button
                    variant="outlined"
                    onClick={handleTestConnection}
                    disabled={!isConfigured || testing}
                    startIcon={testing ? <CircularProgress size={20} /> : <SendIcon />}
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Status Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Connection Status
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                {isConfigured ? (
                  <CheckCircleIcon sx={{ color: 'success.main' }} />
                ) : (
                  <ErrorIcon sx={{ color: 'error.main' }} />
                )}
                <Typography variant="body2">
                  {isConfigured ? 'Configured' : 'Not Configured'}
                </Typography>
              </Box>

              {testResult && (
                <Box sx={{ mt: 2 }}>
                  <Alert severity={testResult.success ? 'success' : 'error'}>
                    {testResult.message}
                  </Alert>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" color="text.secondary">
                <strong>Features:</strong>
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                • Send invoices automatically<br />
                • Payment reminders<br />
                • Outstanding notifications<br />
                • Custom messages
              </Typography>
            </CardContent>
          </Card>

          {/* Instructions Card */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Setup Instructions
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                1. Get WhatsApp Business API from Meta
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                2. Create a business account
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                3. Get your API key and phone number
              </Typography>
              <Typography variant="body2">
                4. Configure settings above
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Preview Messages */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Message Preview
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Invoice Message
            </Typography>
            <Paper sx={{ p: 2, bgcolor: '#f5f5f5', fontFamily: 'monospace', fontSize: '0.875rem' }}>
              Dear Customer,<br /><br />
              Thank you for your business!<br /><br />
              Invoice Details:<br />
              📄 Invoice No: INV-001<br />
              💰 Amount: ₹10,000<br />
              📅 Due Date: 15-Dec-2024<br /><br />
              Please make the payment before the due date.<br /><br />
              Best regards,<br />
              Your Company
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Payment Reminder
            </Typography>
            <Paper sx={{ p: 2, bgcolor: '#fff3cd', fontFamily: 'monospace', fontSize: '0.875rem' }}>
              Dear Customer,<br /><br />
              This is a friendly reminder about your outstanding payment.<br /><br />
              💰 Outstanding Amount: ₹5,000<br />
              📅 Due Date: 15-Dec-2024<br /><br />
              Please make the payment at your earliest convenience.
            </Paper>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
