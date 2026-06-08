import { Typography, Paper, Box, Alert } from '@mui/material';
import { APP_DISPLAY_NAME } from './constants/appBranding';
import { getNormalizedCompanyProfile } from './utils/companyProfile';

export default function CompanyDetails() {
  const profile = getNormalizedCompanyProfile();
  const details = {
    name: profile.businessName?.trim() || APP_DISPLAY_NAME,
    address: profile.address?.trim() || '',
    statePin: [profile.city, profile.state, profile.pinCode].filter(Boolean).join(', '),
    mobiles: profile.phone?.trim() || '',
    email: profile.email?.trim() || '',
    website: profile.website?.trim() || '',
    gstin: profile.gstin?.trim() || '',
  };

  const hasCompleteProfile = details.name && details.address && details.gstin;

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        {details.name} (Company Details)
      </Typography>

      {!hasCompleteProfile && (
        <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
          Please complete your company profile in Settings to display all details properly.
        </Alert>
      )}

      <Box sx={{ mt: 3, lineHeight: 1.8 }}>
        {details.address && (
          <Typography variant="body1">
            <strong>Address:</strong> {details.address}
          </Typography>
        )}
        {details.statePin && (
          <Typography variant="body1">
            <strong>City/State:</strong> {details.statePin}
          </Typography>
        )}
        {details.mobiles && (
          <Typography variant="body1">
            <strong>Phone:</strong> {details.mobiles}
          </Typography>
        )}
        {details.email && (
          <Typography variant="body1">
            <strong>Email:</strong> {details.email}
          </Typography>
        )}
        {details.website && (
          <Typography variant="body1">
            <strong>Website:</strong> {details.website}
          </Typography>
        )}
        {details.gstin && (
          <Typography variant="body1">
            <strong>GSTIN:</strong> {details.gstin}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
