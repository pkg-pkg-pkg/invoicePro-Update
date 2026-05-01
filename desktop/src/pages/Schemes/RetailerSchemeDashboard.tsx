import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import schemeService from '../../services/schemeService';
import schemeCalculationEngine, { SchemeProgress } from '../../services/schemeCalculationEngine';
import { partyService } from '../../services/masters/partyService';

interface RetailerSchemeData {
  id: string;
  name: string;
  gift: string;
  targetAmount: number;
  achievedAmount: number;
  remainingAmount: number;
  progressPercentage: number;
  paymentReceived: number;
  paymentPending: number;
  status: 'red' | 'yellow' | 'green';
  daysRemaining: number;
  paymentTerms: string;
  lastUpdated: string;
}

const RetailerSchemeDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [retailerSchemes, setRetailerSchemes] = useState<RetailerSchemeData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadRetailerSchemes = async () => {
    try {
      setLoading(true);
      setError(null);

      const auth = JSON.parse(localStorage.getItem('gst_billing_auth') || '{}');
      let retailerId =
        auth?.user?.retailerId ||
        auth?.user?.partyId ||
        auth?.user?.ledgerId ||
        auth?.retailer?.id ||
        '';

      if (!retailerId) {
        const parties = await partyService.list({ partyType: ['BUYER', 'BOTH'] });
        const activeRetailer = parties.find((p) => p.status === 'ACTIVE');
        if (activeRetailer?.id) {
          retailerId = activeRetailer.id;
        }
      }

      if (!retailerId) {
        setRetailerSchemes([]);
        setError(null);
        return;
      }
      const data = await schemeService.getRetailerSchemeDashboard(retailerId);
      
      setRetailerSchemes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load retailer schemes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRetailerSchemes();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRetailerSchemes();
  };

  const getStatusColor = (status: 'red' | 'yellow' | 'green') => {
    switch (status) {
      case 'green': return 'success';
      case 'yellow': return 'warning';
      case 'red': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: 'red' | 'yellow' | 'green') => {
    switch (status) {
      case 'green': return <CheckCircleIcon sx={{ color: 'success.main' }} />;
      case 'yellow': return <ScheduleIcon sx={{ color: 'warning.main' }} />;
      case 'red': return <WarningIcon sx={{ color: 'error.main' }} />;
      default: return null;
    }
  };

  const getStatusText = (status: 'red' | 'yellow' | 'green') => {
    switch (status) {
      case 'green': return 'Achieved + Paid';
      case 'yellow': return 'Achieved, Payment Pending';
      case 'red': return 'Target Not Met';
      default: return 'Unknown';
    }
  };

  const getProgressColor = (status: 'red' | 'yellow' | 'green') => {
    switch (status) {
      case 'green': return '#4caf50';
      case 'yellow': return '#ff9800';
      case 'red': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          📊 My Scheme Dashboard
        </Typography>
        <IconButton onClick={handleRefresh} disabled={refreshing}>
          <RefreshIcon sx={{ ...(refreshing && { animation: 'spin 1s linear infinite' }) }} />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                🎯 Total Schemes
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {retailerSchemes.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'success.main', color: 'success.contrastText' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                ✅ Completed
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {retailerSchemes.filter(s => s.status === 'green').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'warning.main', color: 'warning.contrastText' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                ⏳ In Progress
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {retailerSchemes.filter(s => s.status === 'yellow').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'error.main', color: 'error.contrastText' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                ⚠️ At Risk
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {retailerSchemes.filter(s => s.status === 'red').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Scheme Cards */}
      <Grid container spacing={3}>
        {retailerSchemes.map((scheme) => (
          <Grid item xs={12} md={6} key={scheme.id}>
            <Card sx={{ height: '100%', position: 'relative' }}>
              {/* Status Badge */}
              <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
                <Chip
                  icon={getStatusIcon(scheme.status) || undefined}
                  label={getStatusText(scheme.status)}
                  color={getStatusColor(scheme.status)}
                  variant="filled"
                  size="small"
                />
              </Box>

              <CardContent>
                {/* Scheme Header */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    🎁 {scheme.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Gift: {scheme.gift} | Terms: {scheme.paymentTerms}
                  </Typography>
                </Box>

                {/* Progress Section */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Target: {formatCurrency(scheme.targetAmount)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {scheme.progressPercentage.toFixed(1)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(scheme.progressPercentage, 100)}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: getProgressColor(scheme.status),
                        borderRadius: 4,
                      }
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Achieved: {formatCurrency(scheme.achievedAmount)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Remaining: {formatCurrency(scheme.remainingAmount)}
                    </Typography>
                  </Box>
                </Box>

                {/* Payment Status */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                    💳 Payment Status
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'success.light', borderRadius: 1 }}>
                        <Typography variant="h6" sx={{ color: 'success.dark', fontWeight: 'bold' }}>
                          {formatCurrency(scheme.paymentReceived)}
                        </Typography>
                        <Typography variant="caption" color="success.dark">
                          Received
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
                        <Typography variant="h6" sx={{ color: 'warning.dark', fontWeight: 'bold' }}>
                          {formatCurrency(scheme.paymentPending)}
                        </Typography>
                        <Typography variant="caption" color="warning.dark">
                          Pending
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>

                {/* Time Remaining */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    ⏰ Time Remaining
                  </Typography>
                  <Chip
                    label={`${scheme.daysRemaining} days`}
                    color={scheme.daysRemaining <= 30 ? 'error' : scheme.daysRemaining <= 60 ? 'warning' : 'success'}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {retailerSchemes.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            No active schemes found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You haven't enrolled in any schemes yet.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default RetailerSchemeDashboard;
