import { Typography, Paper, Box, Alert } from '@mui/material';

export default function CompanyDetails() {
    const details = {
        name: localStorage.getItem('companyName')?.trim() || 'GST Billing Software',
        address: localStorage.getItem('companyAddress')?.trim() || '',
        statePin: localStorage.getItem('companyStatePin')?.trim() || '',
        mobiles: localStorage.getItem('companyMobiles')?.trim() || '',
        email: localStorage.getItem('companyEmail')?.trim() || '',
        website: localStorage.getItem('companyWebsite')?.trim() || '',
        gstin: localStorage.getItem('companyGSTIN')?.trim() || ''
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
                        <strong>Address:</strong> {details.address}{details.statePin && `, ${details.statePin}`}
                    </Typography>
                )}
                {details.mobiles && (
                    <Typography variant="body1">
                        <strong>Mobile:</strong> {details.mobiles}
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

            <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle2" color="text.secondary">
                    Configure your company details in Settings → Company Profile
                </Typography>
            </Box>
        </Paper>
    );
}
