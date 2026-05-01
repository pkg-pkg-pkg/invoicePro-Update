import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Grid,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import schemeService from '../../services/schemeService';

interface AtRiskRetailer {
  id: string;
  schemeId?: string;
  retailerId?: string;
  name: string;
  phone?: string;
  email?: string;
  schemeName: string;
  targetAmount: number;
  achievedAmount: number;
  percentageDone: number;
  paymentDue: number;
  paymentOverdue: number;
  daysLeft: number;
  status: 'critical' | 'high' | 'medium' | 'low';
  lastPaymentDate?: string;
  riskFactors: string[];
}

const OverdueTracker = () => {
  const [loading, setLoading] = useState(true);
  const [retailers, setRetailers] = useState<AtRiskRetailer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState<AtRiskRetailer | null>(null);
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);

  const loadOverdueRetailers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await schemeService.getOverdueAndAtRiskRetailers();
      setRetailers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load overdue retailers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOverdueRetailers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadOverdueRetailers();
  };

  const handleFreezeScheme = async (retailer: AtRiskRetailer) => {
    try {
      const schemeId = retailer.schemeId;
      const retailerId = retailer.retailerId || retailer.id;
      if (!schemeId || !retailerId) {
        setError('Cannot freeze this row because scheme/retailer ID is missing.');
        return;
      }
      await schemeService.freezeScheme(
        schemeId,
        retailerId,
        'Payment overdue and scheme compliance failure'
      );
      
      // Refresh the list
      await loadOverdueRetailers();
      setFreezeDialogOpen(false);
      setSelectedRetailer(null);
    } catch (err: any) {
      setError(err.message || 'Failed to freeze scheme');
    }
  };

  const getRiskColor = (status: string) => {
    switch (status) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getRiskIcon = (status: string) => {
    switch (status) {
      case 'critical': return <ErrorIcon sx={{ color: 'error.main' }} />;
      case 'high': return <WarningIcon sx={{ color: 'warning.main' }} />;
      case 'medium': return <InfoIcon sx={{ color: 'info.main' }} />;
      case 'low': return <InfoIcon sx={{ color: 'success.main' }} />;
      default: return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return '#4caf50';
    if (percentage >= 50) return '#ff9800';
    return '#f44336';
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
          ⚠️ Overdue & At-Risk Tracker
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
          <Card sx={{ bgcolor: 'error.main', color: 'error.contrastText' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                🔴 Critical Risk
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {retailers.filter(r => r.status === 'critical').length}
              </Typography>
              <Typography variant="body2">
                Immediate action required
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'warning.main', color: 'warning.contrastText' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                🟡 High Risk
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {retailers.filter(r => r.status === 'high').length}
              </Typography>
              <Typography variant="body2">
                Close to missing targets
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'info.main', color: 'info.contrastText' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                🟠 Medium Risk
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {retailers.filter(r => r.status === 'medium').length}
              </Typography>
              <Typography variant="body2">
                Need attention soon
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'success.main', color: 'success.contrastText' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                💰 Total Overdue
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {formatCurrency(retailers.reduce((sum, r) => sum + r.paymentOverdue, 0))}
              </Typography>
              <Typography variant="body2">
                Across all retailers
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Retailer</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Scheme</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Target vs Achieved</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>% Done</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Payment Due</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Overdue</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Days Left</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Risk Level</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {retailers.map((retailer) => (
                <TableRow
                  key={retailer.id}
                  sx={{
                    '&:hover': { bgcolor: 'action.hover' },
                    bgcolor: retailer.status === 'critical' ? 'error.light' : 
                           retailer.status === 'high' ? 'warning.light' : 'transparent'
                  }}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {retailer.name}
                      </Typography>
                      {retailer.phone && (
                        <Typography variant="caption" color="text.secondary">
                          📞 {retailer.phone}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {retailer.schemeName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {formatCurrency(retailer.targetAmount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        vs {formatCurrency(retailer.achievedAmount)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(retailer.percentageDone, 100)}
                        sx={{
                          width: 60,
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: getProgressColor(retailer.percentageDone),
                            borderRadius: 3,
                          }
                        }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {retailer.percentageDone.toFixed(1)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 500 }}>
                      {formatCurrency(retailer.paymentDue)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 500 }}>
                      {formatCurrency(retailer.paymentOverdue)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`${retailer.daysLeft} days`}
                      color={retailer.daysLeft <= 7 ? 'error' : retailer.daysLeft <= 30 ? 'warning' : 'default'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getRiskIcon(retailer.status) || undefined}
                      label={retailer.status.toUpperCase()}
                      color={getRiskColor(retailer.status)}
                      size="small"
                      variant="filled"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {retailer.phone && (
                        <Tooltip title="Call Retailer">
                          <IconButton size="small" color="primary">
                            <PhoneIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {retailer.email && (
                        <Tooltip title="Send Email">
                          <IconButton size="small" color="info">
                            <EmailIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Freeze Scheme">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setSelectedRetailer(retailer);
                            setFreezeDialogOpen(true);
                          }}
                        >
                          <BlockIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Freeze Confirmation Dialog */}
      <Dialog open={freezeDialogOpen} onClose={() => setFreezeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          ⚠️ Freeze Scheme Confirmation
        </DialogTitle>
        <DialogContent>
          {selectedRetailer && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This action will immediately freeze the scheme for {selectedRetailer.name} due to payment non-compliance.
              </Alert>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Retailer:</strong> {selectedRetailer.name}<br />
                <strong>Scheme:</strong> {selectedRetailer.schemeName}<br />
                <strong>Payment Overdue:</strong> {formatCurrency(selectedRetailer.paymentOverdue)}<br />
                <strong>Days Overdue:</strong> {Math.abs(selectedRetailer.daysLeft)} days
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The retailer will lose all scheme benefits and will need to contact support to reactivate.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFreezeDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedRetailer && handleFreezeScheme(selectedRetailer)}
            color="error"
            variant="contained"
          >
            Freeze Scheme
          </Button>
        </DialogActions>
      </Dialog>

      {/* Empty State */}
      {retailers.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            🎉 No At-Risk Retailers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All retailers are compliant with their scheme requirements.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default OverdueTracker;
