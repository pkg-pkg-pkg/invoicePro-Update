import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
  Divider,
} from '@mui/material';
import schemeService from '../../services/schemeService';
import schemeCalculationEngine from '../../services/schemeCalculationEngine';

interface SmartSchemeData {
  name: string;
  giftCost: number;
  marginBurnPercentage: number;
  paymentTerms: '7_days' | '15_days' | '30_days' | 'COD';
  startDate: Date | null;
  endDate: Date | null;
  productIds: string[];
  appliesTo: 'SALES' | 'PURCHASE' | 'BOTH';
}

const SmartSchemeForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<SmartSchemeData>({
    name: '',
    giftCost: 0,
    marginBurnPercentage: 0,
    paymentTerms: '30_days',
    startDate: new Date(),
    endDate: new Date(),
    productIds: [],
    appliesTo: 'BOTH'
  });

  // Auto-calculated target
  const [calculatedTarget, setCalculatedTarget] = useState<number>(0);

  // Recalculate target when gift cost or margin changes
  useEffect(() => {
    if (formData.giftCost > 0 && formData.marginBurnPercentage > 0) {
      const target = schemeCalculationEngine.calculateAutoTarget(
        formData.giftCost,
        formData.marginBurnPercentage
      );
      setCalculatedTarget(target);
    } else {
      setCalculatedTarget(0);
    }
  }, [formData.giftCost, formData.marginBurnPercentage]);

  const handleInputChange = (field: keyof SmartSchemeData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validation
      if (!formData.name.trim()) {
        throw new Error('Scheme name is required');
      }
      if (formData.giftCost <= 0) {
        throw new Error('Gift cost must be greater than 0');
      }
      if (formData.marginBurnPercentage <= 0 || formData.marginBurnPercentage > 100) {
        throw new Error('Margin burn percentage must be between 1 and 100');
      }
      if (!formData.startDate || !formData.endDate) {
        throw new Error('Start and end dates are required');
      }
      if (formData.startDate >= formData.endDate) {
        throw new Error('End date must be after start date');
      }

      // Create smart scheme
      await schemeService.createSmartScheme({
        companyId: 'current-company', // TODO: Get from context
        name: formData.name,
        giftCost: formData.giftCost,
        marginBurnPercentage: formData.marginBurnPercentage,
        paymentTerms: formData.paymentTerms,
        startDate: formData.startDate!,
        endDate: formData.endDate!,
        productIds: formData.productIds,
        appliesTo: formData.appliesTo
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/schemes');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to create smart scheme');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Create Smart Scheme
      </Typography>

      <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
        Auto-calculate targets based on gift cost and margin burn percentage
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Smart scheme created successfully! Redirecting...
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              🎁 Scheme Information
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Scheme Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., Goa Trip Scheme"
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Applies To</InputLabel>
              <Select
                value={formData.appliesTo}
                onChange={(e) => handleInputChange('appliesTo', e.target.value)}
                label="Applies To"
              >
                <MenuItem value="SALES">Sales Only</MenuItem>
                <MenuItem value="PURCHASE">Purchase Only</MenuItem>
                <MenuItem value="BOTH">Sales & Purchase</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Gift and Margin Configuration */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>
              💰 Gift & Margin Configuration
            </Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Gift Cost (₹)"
              type="number"
              value={formData.giftCost}
              onChange={(e) => handleInputChange('giftCost', parseFloat(e.target.value) || 0)}
              placeholder="e.g., 60000"
              helperText="Cost of the gift/trip in rupees"
              required
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Margin Burn (%)"
              type="number"
              value={formData.marginBurnPercentage}
              onChange={(e) => handleInputChange('marginBurnPercentage', parseFloat(e.target.value) || 0)}
              placeholder="e.g., 3"
              helperText="Percentage of margin to burn for this scheme"
              inputProps={{ min: 0.1, max: 100, step: 0.1 }}
              required
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Payment Terms</InputLabel>
              <Select
                value={formData.paymentTerms}
                onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                label="Payment Terms"
              >
                <MenuItem value="7_days">7 Days</MenuItem>
                <MenuItem value="15_days">15 Days</MenuItem>
                <MenuItem value="30_days">30 Days</MenuItem>
                <MenuItem value="COD">COD</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Auto-Calculated Target Display */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                🎯 Auto-Calculated Target
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Formula: Gift Cost ÷ Margin %
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Calculation: ₹{formData.giftCost.toLocaleString()} ÷ {formData.marginBurnPercentage}%
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    ₹{calculatedTarget.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Target Billing Amount
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Date Configuration */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>
              📅 Scheme Period
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={formData.startDate ? formData.startDate.toISOString().split('T')[0] : ''}
              onChange={(e) => handleInputChange('startDate', e.target.value ? new Date(e.target.value) : null)}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="End Date"
              type="date"
              value={formData.endDate ? formData.endDate.toISOString().split('T')[0] : ''}
              onChange={(e) => handleInputChange('endDate', e.target.value ? new Date(e.target.value) : null)}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/schemes')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : null}
              >
                {loading ? 'Creating...' : 'Create Smart Scheme'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default SmartSchemeForm;
