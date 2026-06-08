import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  Grid,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Business, Person, Palette, Backup, Restore, CheckCircle } from '@mui/icons-material';
import { pickBackupFile } from '../services/fileDialogService';
import { restoreCompanyDetailsFromCloud, saveCompanyDetailsToCloud, archiveCompanyDetails } from '../services/companyDetailsCloudService';
import { APP_DISPLAY_NAME, APP_TAGLINE } from '../constants/appBranding';
import { usePincodeAutofill } from '../hooks/usePincodeAutofill';
import PincodeTextField from './PincodeTextField';
import {
  getActiveCompanyProfileRow,
  markCompanyProfileCompleted,
  normalizedToUpsertPayload,
  upsertCompanyProfile,
} from '../services/companyProfileDbService';
import { applyCloudCompanyDetailsToDb } from '../services/businessProfileService';

interface CompanyData {
  name: string;
  legalName: string;
  gstin: string;
  pan: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  branch: string;
  logo?: string;
  themeColor: string;
}

interface BackupInfo {
  version: string;
  companyName: string;
  gstin: string;
  backupDate: string;
  invoiceCount: number;
  customerCount: number;
  supplierCount: number;
  size: string;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
];

interface SetupWizardProps {
  open: boolean;
  onComplete: (companyData: CompanyData) => void;
  onRestoreBackup: (backupPath: string) => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ open, onComplete, onRestoreBackup }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [hasBackup, setHasBackup] = useState<boolean | null>(null);
  const [backupFile, setBackupFile] = useState<string>('');
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [cloudMode, setCloudMode] = useState<'idle' | 'restore' | 'new'>('idle');
  const [restoreEmail, setRestoreEmail] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [oldEmailForArchive, setOldEmailForArchive] = useState('');

  const [hasLocalCompany, setHasLocalCompany] = useState(false);

  useEffect(() => {
    void (async () => {
      const row = await getActiveCompanyProfileRow();
      setHasLocalCompany(Boolean(row?.company_name && row?.is_profile_completed));
    })();
  }, []);

  const [companyData, setCompanyData] = useState<CompanyData>({
    name: '',
    legalName: '',
    gstin: '',
    pan: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    district: '',
    state: '',
    pincode: '',
    phone: '',
    mobile: '',
    email: '',
    website: '',
    bankName: '',
    accountNo: '',
    ifscCode: '',
    branch: '',
    themeColor: '#b8860b',
  });

  const [errors, setErrors] = useState<Partial<CompanyData>>({});

  const pinAutofill = usePincodeAutofill({
    onFilled: useCallback((addr) => {
      setCompanyData((prev) => ({
        ...prev,
        city: addr.city,
        district: addr.district,
        state: addr.state,
      }));
    }, []),
  });

  const steps = hasBackup === false ? [
    'Welcome',
    'Company Details',
    'Contact Information',
    'Branding',
    'Complete'
  ] : [
    'Welcome',
    'Backup Option',
    'Complete'
  ];

  const handleNext = () => {
    if (validateCurrentStep()) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleBackupOption = (hasBackupChoice: boolean) => {
    setHasBackup(hasBackupChoice);
    if (!hasBackupChoice) {
      setActiveStep(1); // Go to company details
    }
  };

  const handleBackupFileSelect = async () => {
    setBackupInfo(null);
    const picked = await pickBackupFile({
      title: 'Select backup file (.ipbak)',
      defaultPath: backupFile || undefined,
    });
    if (picked?.trim()) {
      setBackupFile(picked.trim());
    }
  };

  const handleRestoreBackup = () => {
    if (backupFile) {
      setLoading(true);
      // Simulate restore process
      setTimeout(() => {
        onRestoreBackup(backupFile);
        setLoading(false);
      }, 3000);
    }
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: Partial<CompanyData> = {};

    if (hasBackup === false) {
      if (activeStep === 1) { // Company Details
        if (!companyData.name.trim()) newErrors.name = 'Company name is required';
        if (!companyData.addressLine1.trim()) newErrors.addressLine1 = 'Address is required';
        if (!companyData.city.trim()) newErrors.city = 'City is required';
        if (!companyData.state.trim()) newErrors.state = 'State is required';
        if (!companyData.pincode.trim()) newErrors.pincode = 'PIN code is required';
        if (companyData.pincode && !/^\d{6}$/.test(companyData.pincode)) {
          newErrors.pincode = 'PIN code must be 6 digits';
        }
        if (companyData.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}[A-Z\d]{1}$/.test(companyData.gstin)) {
          newErrors.gstin = 'Invalid GSTIN format';
        }
        if (companyData.pan && !/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(companyData.pan)) {
          newErrors.pan = 'Invalid PAN format';
        }
      } else if (activeStep === 2) { // Contact Information
        if (!companyData.phone.trim()) newErrors.phone = 'Phone number is required';
        if (companyData.phone && !/^\d{10}$/.test(companyData.phone.replace(/\D/g, ''))) {
          newErrors.phone = 'Phone number must be 10 digits';
        }
        if (!companyData.email.trim()) newErrors.email = 'Email is required';
        if (companyData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyData.email)) {
          newErrors.email = 'Invalid email format';
        }
        if (companyData.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(companyData.ifscCode)) {
          newErrors.ifscCode = 'Invalid IFSC code format';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleComplete = () => {
    if (!validateCurrentStep()) return;
    void (async () => {
      const address = `${companyData.addressLine1} ${companyData.addressLine2}`.trim();
      await upsertCompanyProfile(
        normalizedToUpsertPayload(
          {
            businessName: companyData.name,
            name: companyData.name,
            ownerName: companyData.legalName,
            address,
            city: companyData.city,
            state: companyData.state,
            pinCode: companyData.pincode,
            phone: companyData.phone || companyData.mobile,
            email: companyData.email,
            gstin: companyData.gstin,
            pan: companyData.pan,
            website: companyData.website,
            bank: companyData.bankName,
            accountNo: companyData.accountNo,
            ifsc: companyData.ifscCode,
            bankBranch: companyData.branch,
            logo: companyData.logo,
          },
          { markCompleted: true }
        )
      );
      await markCompanyProfileCompleted(companyData.name);
      window.dispatchEvent(new Event('companyProfileUpdated'));
      onComplete(companyData);

      if (companyData.email && companyData.name) {
        saveCompanyDetailsToCloud({
          email: companyData.email,
          companyName: companyData.name,
          phone: companyData.phone,
          address,
          extra: companyData,
        }).catch((err) => {
          console.error('Failed to sync setup wizard company details to cloud:', err);
        });
      }
    })();
  };

  const updateCompanyData = (field: keyof CompanyData, value: string) => {
    setCompanyData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const renderWelcomeStep = () => (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
        Welcome to {APP_DISPLAY_NAME}! 🎉
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, color: 'text.secondary' }}>
        {APP_TAGLINE}
      </Typography>
      <Typography variant="body1" sx={{ mb: 4 }}>
        Let's set up your business in just a few simple steps.
        We'll help you configure your company details and get you started with creating invoices.
      </Typography>

      {!hasLocalCompany && (
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle1" gutterBottom>
            How do you want to start?
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Restore />}
                onClick={() => {
                  setCloudMode('restore');
                  setActiveStep(hasBackup === false ? 1 : 0);
                }}
              >
                Restore my existing company
              </Button>
            </Grid>
            <Grid item xs={12} md={6}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={() => {
                  setCloudMode('new');
                  setHasBackup(false);
                  setActiveStep(1);
                }}
              >
                Set up as new company
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}
      <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
        <Typography variant="body2" color="text.secondary">
          <strong>What we'll set up:</strong>
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          • Company information and branding<br/>
          • Contact details and banking information<br/>
          • Invoice templates and settings<br/>
          • User preferences and customization
        </Typography>
      </Paper>
    </Box>
  );

  const renderBackupOptionStep = () => (
    <Box sx={{ py: 2 }}>
      <Typography variant="h6" gutterBottom>
        Restore or start new
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        You can restore your company either from the cloud (email based) or from a local backup file, or start as a new company.
      </Typography>

      <Box sx={{ mb: 3, p: 2, borderRadius: 1, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom>
          Restore from cloud (recommended)
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Registered Email"
              value={restoreEmail}
              onChange={(e) => setRestoreEmail(e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              variant="contained"
              disabled={!restoreEmail.trim() || restoreLoading}
              onClick={async () => {
                setRestoreError(null);
                setRestoreLoading(true);
                try {
                  const cloud = await restoreCompanyDetailsFromCloud(restoreEmail.trim());
                  if (!cloud) {
                    setRestoreError('No company found with this email. Please check or set up as new.');
                  } else {
                    await applyCloudCompanyDetailsToDb(cloud);
                    onComplete({
                      ...companyData,
                      name: cloud.companyName,
                      email: cloud.email,
                      phone: cloud.phone ?? '',
                      addressLine1: cloud.address ?? '',
                    });
                  }
                } catch (err: any) {
                  setRestoreError(err?.message || 'Failed to restore company details from cloud.');
                } finally {
                  setRestoreLoading(false);
                }
              }}
            >
              {restoreLoading ? <CircularProgress size={18} /> : 'Restore from Cloud'}
            </Button>
          </Grid>
        </Grid>
        {restoreError && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {restoreError}
          </Typography>
        )}
      </Box>

      <RadioGroup
        value={hasBackup}
        onChange={(e) => handleBackupOption(e.target.value === 'true')}
      >
        <FormControlLabel
          value={true}
          control={<Radio />}
          label={
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                Yes, I have a backup file
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Restore my company data, customers, invoices, and settings
              </Typography>
            </Box>
          }
        />
        <FormControlLabel
          value={false}
          control={<Radio />}
          label={
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                No, start fresh setup
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Set up a new company from scratch
              </Typography>
            </Box>
          }
        />
      </RadioGroup>

      {hasBackup && (
        <Box sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            onClick={handleBackupFileSelect}
            startIcon={<Backup />}
            fullWidth
          >
            Browse for Backup File (.ipbak)
          </Button>

          {backupFile && (
            <Paper sx={{ p: 2, mt: 2, bgcolor: 'success.light' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Selected Backup File:
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 2 }}>
                {backupFile}
              </Typography>

              {backupInfo && (
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Backup Information:</strong>
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption">Company:</Typography>
                      <Typography variant="body2">{backupInfo.companyName}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption">GSTIN:</Typography>
                      <Typography variant="body2">{backupInfo.gstin}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption">Invoices:</Typography>
                      <Typography variant="body2">{backupInfo.invoiceCount}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption">Customers:</Typography>
                      <Typography variant="body2">{backupInfo.customerCount}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption">Backup Date:</Typography>
                      <Typography variant="body2">
                        {new Date(backupInfo.backupDate).toLocaleDateString()}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );

  const renderCompanyDetailsStep = () => (
    <Box sx={{ py: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <Business sx={{ mr: 1 }} />
        Company Information
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Company Name"
            value={companyData.name}
            onChange={(e) => updateCompanyData('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            required
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Legal Name (if different)"
            value={companyData.legalName}
            onChange={(e) => updateCompanyData('legalName', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="GSTIN"
            value={companyData.gstin}
            onChange={(e) => updateCompanyData('gstin', e.target.value)}
            error={!!errors.gstin}
            helperText={errors.gstin}
            placeholder="22AAAAA0000A1Z5"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="PAN"
            value={companyData.pan}
            onChange={(e) => updateCompanyData('pan', e.target.value)}
            error={!!errors.pan}
            helperText={errors.pan}
            placeholder="AAAAA0000A"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Address Line 1"
            value={companyData.addressLine1}
            onChange={(e) => updateCompanyData('addressLine1', e.target.value)}
            error={!!errors.addressLine1}
            helperText={errors.addressLine1}
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Address Line 2"
            value={companyData.addressLine2}
            onChange={(e) => updateCompanyData('addressLine2', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <PincodeTextField
            fullWidth
            label="PIN Code"
            value={companyData.pincode}
            onPinChange={(pin) => updateCompanyData('pincode', pin)}
            autofill={pinAutofill}
            validationError={!!errors.pincode}
            helperText={errors.pincode}
            required
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="City"
            value={companyData.city}
            onChange={(e) => {
              pinAutofill.clearHighlight('city');
              updateCompanyData('city', e.target.value);
            }}
            sx={pinAutofill.fieldSx('city')}
            error={!!errors.city}
            helperText={errors.city}
            required
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="District"
            value={companyData.district}
            onChange={(e) => {
              pinAutofill.clearHighlight('district');
              updateCompanyData('district', e.target.value);
            }}
            sx={pinAutofill.fieldSx('district')}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth error={!!errors.state} sx={pinAutofill.fieldSx('state')}>
            <InputLabel>State *</InputLabel>
            <Select
              value={companyData.state}
              onChange={(e) => {
                pinAutofill.clearHighlight('state');
                updateCompanyData('state', e.target.value);
              }}
              label="State"
            >
              {INDIAN_STATES.map((state) => (
                <MenuItem key={state} value={state}>
                  {state}
                </MenuItem>
              ))}
            </Select>
            {errors.state && <Typography variant="caption" color="error">{errors.state}</Typography>}
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );

  const renderContactDetailsStep = () => (
    <Box sx={{ py: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <Person sx={{ mr: 1 }} />
        Contact Information
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Phone"
            value={companyData.phone}
            onChange={(e) => updateCompanyData('phone', e.target.value)}
            error={!!errors.phone}
            helperText={errors.phone}
            required
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Mobile"
            value={companyData.mobile}
            onChange={(e) => updateCompanyData('mobile', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Email"
            value={companyData.email}
            onChange={(e) => updateCompanyData('email', e.target.value)}
            error={!!errors.email}
            helperText={errors.email}
            required
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Website"
            value={companyData.website}
            onChange={(e) => updateCompanyData('website', e.target.value)}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        Banking Information (Optional)
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Bank Name"
            value={companyData.bankName}
            onChange={(e) => updateCompanyData('bankName', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Account Number"
            value={companyData.accountNo}
            onChange={(e) => updateCompanyData('accountNo', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="IFSC Code"
            value={companyData.ifscCode}
            onChange={(e) => updateCompanyData('ifscCode', e.target.value)}
            error={!!errors.ifscCode}
            helperText={errors.ifscCode}
            placeholder="ABCD0123456"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Branch"
            value={companyData.branch}
            onChange={(e) => updateCompanyData('branch', e.target.value)}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderBrandingStep = () => (
    <Box sx={{ py: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <Palette sx={{ mr: 1 }} />
        Personalize Your Software
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
            <Typography variant="subtitle1" gutterBottom>
              Company Logo
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload your company logo (JPG, PNG, max 2MB)
            </Typography>
            <Button variant="outlined" startIcon={<Palette />}>
              Upload Logo
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Or use default logo
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Invoice Theme Color
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: companyData.themeColor,
                  borderRadius: 1,
                  border: '2px solid',
                  borderColor: 'grey.300'
                }}
              />
              <TextField
                label="Color"
                value={companyData.themeColor}
                onChange={(e) => updateCompanyData('themeColor', e.target.value)}
                sx={{ width: 120 }}
              />
              <Typography variant="body2" color="text.secondary">
                Golden (Default)
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  const renderCompleteStep = () => (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      {hasBackup ? (
        <>
          <Restore sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
            Restoring Your Data
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            We're restoring your backup data. This may take a few moments...
          </Typography>
          {loading && <CircularProgress sx={{ mb: 2 }} />}
        </>
      ) : (
        <>
          <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
            Setup Complete! 🎉
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Your company profile is ready. You can now start creating invoices and managing your business.
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'info.light', display: 'inline-block' }}>
            <Typography variant="body2">
              <strong>Quick Tips:</strong><br/>
              • Add products in the Products section<br/>
              • Add customers before creating invoices<br/>
              • Regular backups are recommended
            </Typography>
          </Paper>
        </>
      )}
    </Box>
  );

  const getStepContent = (step: number) => {
    if (hasBackup === null) {
      return renderWelcomeStep();
    }

    if (hasBackup) {
      switch (step) {
        case 0: return renderWelcomeStep();
        case 1: return renderBackupOptionStep();
        case 2: return renderCompleteStep();
        default: return renderWelcomeStep();
      }
    } else {
      switch (step) {
        case 0: return renderWelcomeStep();
        case 1: return renderCompanyDetailsStep();
        case 2: return renderContactDetailsStep();
        case 3: return renderBrandingStep();
        case 4: return renderCompleteStep();
        default: return renderWelcomeStep();
      }
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown
      disableEnforceFocus
      sx={{ '& .MuiDialog-paper': { minHeight: '600px' } }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 3, pb: 1 }}>
          <Typography variant="h5" align="center" gutterBottom>
            {APP_DISPLAY_NAME} Setup Wizard
          </Typography>

          {hasBackup !== null && (
            <Stepper activeStep={activeStep} sx={{ mt: 2, mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          )}
        </Box>

        <Box sx={{ px: 3, pb: 2 }}>
          {getStepContent(activeStep)}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        {activeStep > 0 && activeStep < steps.length - 1 && (
          <Button onClick={handleBack} variant="outlined">
            Back
          </Button>
        )}

        {hasBackup === null ? (
          <Button
            onClick={() => setHasBackup(false)}
            variant="contained"
            size="large"
          >
            Get Started
          </Button>
        ) : hasBackup && activeStep === 1 && backupFile ? (
          <Button
            onClick={handleRestoreBackup}
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <Restore />}
          >
            {loading ? 'Restoring...' : 'Restore & Continue'}
          </Button>
        ) : hasBackup && activeStep === 1 ? (
          <Button
            onClick={() => setHasBackup(false)}
            variant="outlined"
          >
            Skip & Setup Fresh
          </Button>
        ) : activeStep === (hasBackup ? 1 : 3) ? (
          <Button
            onClick={handleComplete}
            variant="contained"
            size="large"
            startIcon={<CheckCircle />}
          >
            Finish Setup
          </Button>
        ) : activeStep < (hasBackup ? 1 : 3) ? (
          <Button
            onClick={handleNext}
            variant="contained"
            size="large"
          >
            Next
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
};

export default SetupWizard;
