import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Tooltip,
  Checkbox,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  AcUnit as FreezeIcon,
  PlayArrow as PlayArrowIcon,
  Calculate as CalculateIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Payment as PaymentIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { inventoryItemService } from '../../services/masters/inventoryItemService';
import { partyService } from '../../services/masters/partyService';
import { voucherService } from '../../services/vouchers/voucherService';
import { InventoryItem } from '../../types/masters';
import { Party } from '../../types/party';
import schemeCalculationEngine, { MarginData } from '../../services/schemeCalculationEngine';
import schemeService, { Scheme } from '../../services/schemeService';
import RetailerSchemeDashboard from './RetailerSchemeDashboard';
import OverdueTracker from './OverdueTracker';

interface SchemeProgress {
  retailerId: string;
  retailerName: string;
  schemeId: string;
  schemeName: string;
  target: number;
  achieved: number;
  remaining: number;
  percentage: number;
  status: 'RED' | 'YELLOW' | 'GREEN';
  paymentsReceived: number;
  paymentsPending: number;
  daysLeft: number;
  isOverdue: boolean;
}

interface ProductSelection {
  productId: string;
  productName: string;
  selected: boolean;
  marginPercentage: number;
  costPrice: number;
  sellingPrice: number;
}

const isRetailerNameValid = (name: string | undefined) => {
  const value = String(name ?? '').trim();
  if (value.length < 2) return false;
  // Reject names that are mostly symbols/random tokens.
  const alphaNum = value.replace(/[^a-zA-Z0-9]/g, '');
  return alphaNum.length >= 3;
};

const toSmartTab = (tab: string | undefined): 'create' | 'dashboard' | 'payment' | 'achievement' => {
  if (tab === 'dashboard' || tab === 'payment' || tab === 'achievement') return tab;
  return 'create';
};

const SmartSchemeEngine = ({ initialTabFromQuery }: { initialTabFromQuery?: string }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'dashboard' | 'payment' | 'achievement'>(toSmartTab(initialTabFromQuery));
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [retailers, setRetailers] = useState<Party[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [schemeProgress, setSchemeProgress] = useState<SchemeProgress[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductSelection[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Form state for creating new scheme
  const [formData, setFormData] = useState({
    retailerId: '',
    appliesTo: 'SALES' as 'SALES' | 'PURCHASE' | 'BOTH',
    giftCost: '',
    paymentTerms: '15_days' as '7_days' | '15_days' | '30_days' | 'COD',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setActiveTab(toSmartTab(initialTabFromQuery));
  }, [initialTabFromQuery]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load products for margin calculation
      const productsData = await inventoryItemService.list({ includeInactive: false });
      const activeProducts = productsData.filter(p => p.status === 'ACTIVE');
      setProducts(activeProducts);

      // Initialize product selections
      const productSelections: ProductSelection[] = activeProducts.map(product => ({
        productId: product.id,
        productName: product.name,
        selected: false,
        marginPercentage: 0,
        costPrice: product.pricing?.purchase || 0,
        sellingPrice: product.pricing?.sale || 0,
      }));
      setSelectedProducts(productSelections);

      // Load customers/suppliers for smart scheme mapping
      const retailersData = await partyService.list({ partyType: ['BUYER', 'SUPPLIER', 'BOTH'] });
      const cleanRetailers = retailersData.filter(
        (party) => party.status !== 'INACTIVE' && isRetailerNameValid(party.name)
      );
      setRetailers(cleanRetailers);

      // Load existing schemes
      await loadSchemes();
      await loadSchemeProgress();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSchemes = async () => {
    try {
      const auth = JSON.parse(localStorage.getItem('gst_billing_auth') || '{}');
      const companyId = auth.user?.companyId || auth.company?.id;
      if (companyId) {
        const schemesData = await schemeService.getSchemes(companyId);
        setSchemes(schemesData);
      }
    } catch (error) {
      console.error('Error loading schemes:', error);
    }
  };

  const loadSchemeProgress = async () => {
    try {
      // For now, create mock data since getProgressDashboard doesn't exist
      const mockProgress: SchemeProgress[] = [];
      setSchemeProgress(mockProgress);
    } catch (error) {
      console.error('Error loading scheme progress:', error);
    }
  };

  // Phase 1: Auto Margin Engine
  const calculateMargin = (productId: string, sellingPrice: number): MarginData | null => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.pricing?.purchase) return null;

    const costPrice = product.pricing.purchase;
    return schemeCalculationEngine.calculateRealtimeMargin(costPrice, sellingPrice);
  };

  // Phase 2: Smart Target Logic
  const calculateTarget = (giftCost: number): number => {
    const selectedProductsList = selectedProducts.filter(p => p.selected);
    if (selectedProductsList.length === 0) return 0;
    
    // Calculate average margin percentage from selected products
    const totalMargin = selectedProductsList.reduce((sum, product) => sum + product.marginPercentage, 0);
    const averageMarginPercentage = totalMargin / selectedProductsList.length;
    
    if (averageMarginPercentage <= 0) return 0;
    return Number((giftCost / (averageMarginPercentage / 100)).toFixed(2));
  };

  // Handle product selection
  const handleProductToggle = (productId: string) => {
    setSelectedProducts(prev => 
      prev.map(product => 
        product.productId === productId 
          ? { ...product, selected: !product.selected }
          : product
      )
    );
  };

  // Handle margin percentage change
  const handleMarginChange = (productId: string, marginPercentage: number) => {
    setSelectedProducts(prev => 
      prev.map(product => 
        product.productId === productId 
          ? { ...product, marginPercentage }
          : product
      )
    );
  };

  // Get current target calculation
  const getCurrentTarget = () => {
    const giftCost = Number(formData.giftCost) || 0;
    return calculateTarget(giftCost);
  };

  const partnerLabel = formData.appliesTo === 'PURCHASE' ? 'Supplier' : formData.appliesTo === 'BOTH' ? 'Party' : 'Retailer';

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return selectedProducts;
    return selectedProducts.filter((p) => p.productName.toLowerCase().includes(q));
  }, [selectedProducts, productSearch]);

  const eligiblePartners = useMemo(() => {
    if (formData.appliesTo === 'PURCHASE') {
      return retailers.filter((p) => p.partyType === 'SUPPLIER' || p.partyType === 'BOTH');
    }
    if (formData.appliesTo === 'SALES') {
      return retailers.filter((p) => p.partyType === 'BUYER' || p.partyType === 'BOTH');
    }
    return retailers;
  }, [retailers, formData.appliesTo]);

  useEffect(() => {
    if (!formData.retailerId) return;
    if (eligiblePartners.some((p) => p.id === formData.retailerId)) return;
    setFormData((prev) => ({ ...prev, retailerId: '' }));
  }, [eligiblePartners, formData.retailerId]);

  // Handle form changes
  const handleInputChange = (field: string) => (event: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  // Create new scheme
  const handleCreateScheme = async () => {
    if (!formData.retailerId || !formData.giftCost) {
      alert('Please fill all required fields');
      return;
    }

    const selectedProductsList = selectedProducts.filter(p => p.selected);
    if (selectedProductsList.length === 0) {
      alert('Please select at least one product for the scheme');
      return;
    }

    const invalidMargins = selectedProductsList.filter(p => p.marginPercentage <= 0);
    if (invalidMargins.length > 0) {
      alert('Please set margin percentage greater than 0 for all selected products');
      return;
    }

    setLoading(true);
    try {
      const retailer = retailers.find(r => r.id === formData.retailerId);
      if (!retailer) {
        alert('Invalid retailer selected');
        return;
      }

      const auth = JSON.parse(localStorage.getItem('gst_billing_auth') || '{}');
      const companyId = auth.user?.companyId || auth.company?.id;

      if (!companyId) {
        alert('Company ID not found');
        return;
      }

      const giftCost = Number(formData.giftCost);
      await schemeService.createSmartScheme({
        companyId,
        name: `${retailer.name} - ${formData.appliesTo === 'PURCHASE' ? 'Purchase' : 'Sales'} Gift Scheme`,
        giftCost,
        marginBurnPercentage: selectedProductsList.reduce((sum, p) => sum + p.marginPercentage, 0) / selectedProductsList.length,
        paymentTerms: formData.paymentTerms,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        productIds: selectedProductsList.map(p => p.productId),
        appliesTo: formData.appliesTo,
      });

      await loadSchemes();
      
      // Reset form
      setFormData({
        retailerId: '',
        appliesTo: 'SALES',
        giftCost: '',
        paymentTerms: '15_days',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });

      // Reset product selections
      setSelectedProducts(prev => prev.map(p => ({ ...p, selected: false, marginPercentage: 0 })));

      alert('Smart Scheme created successfully!');
    } catch (error) {
      console.error('Error creating scheme:', error);
      alert('Failed to create scheme');
    } finally {
      setLoading(false);
    }
  };

  // Freeze/Release scheme
  const handleFreezeScheme = async (schemeId: string) => {
    try {
      const auth = JSON.parse(localStorage.getItem('gst_billing_auth') || '{}');
      const companyId = auth.user?.companyId || auth.company?.id;
      if (companyId) {
        await schemeService.freezeScheme(schemeId, companyId, 'Payment terms missed - Auto freeze');
        await loadSchemes();
      }
    } catch (error) {
      console.error('Error freezing scheme:', error);
      alert('Failed to freeze scheme');
    }
  };

  const handleReleaseScheme = async (schemeId: string) => {
    try {
      const auth = JSON.parse(localStorage.getItem('gst_billing_auth') || '{}');
      const companyId = auth.user?.companyId || auth.company?.id;
      if (companyId) {
        await schemeService.releaseScheme(schemeId, companyId);
        await loadSchemes();
      }
    } catch (error) {
      console.error('Error releasing scheme:', error);
      alert('Failed to release scheme');
    }
  };

  // Get status color and icon
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'GREEN':
        return { color: 'success', icon: <CheckCircleIcon />, label: 'Active - All Clear' };
      case 'YELLOW':
        return { color: 'warning', icon: <WarningIcon />, label: 'Billing Done - Payment Pending' };
      case 'RED':
        return { color: 'error', icon: <CancelIcon />, label: 'Target Not Met' };
      case 'FROZEN':
        return { color: 'default', icon: <FreezeIcon />, label: 'Frozen - Payment Missed' };
      default:
        return { color: 'default', icon: <CancelIcon />, label: 'Unknown' };
    }
  };

  // Render Create Scheme Tab
  const renderCreateScheme = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Typography variant="h6" gutterBottom>
          🎯 Create New Smart Scheme
        </Typography>
        
        <Card>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>{`Select ${partnerLabel}`}</InputLabel>
                  <Select
                    value={formData.retailerId}
                    label={`Select ${partnerLabel}`}
                    onChange={handleInputChange('retailerId')}
                  >
                    {eligiblePartners.map(retailer => (
                      <MenuItem key={retailer.id} value={retailer.id}>
                        {retailer.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Scheme For</InputLabel>
                  <Select
                    value={formData.appliesTo}
                    label="Scheme For"
                    onChange={handleInputChange('appliesTo')}
                  >
                    <MenuItem value="SALES">Sales Scheme</MenuItem>
                    <MenuItem value="PURCHASE">Purchase Scheme</MenuItem>
                    <MenuItem value="BOTH">Both Sales + Purchase</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Gift Cost (₹)"
                  type="number"
                  value={formData.giftCost}
                  onChange={handleInputChange('giftCost')}
                  inputProps={{ min: 0, step: '0.01' }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Payment Terms</InputLabel>
                  <Select
                    value={formData.paymentTerms}
                    label="Payment Terms"
                    onChange={handleInputChange('paymentTerms')}
                  >
                    <MenuItem value="7_days">7 Days</MenuItem>
                    <MenuItem value="15_days">15 Days</MenuItem>
                    <MenuItem value="30_days">30 Days</MenuItem>
                    <MenuItem value="COD">COD</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={formData.startDate}
                  onChange={handleInputChange('startDate')}
                  inputProps={{ min: new Date().toISOString().split('T')[0] }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={formData.endDate}
                  onChange={handleInputChange('endDate')}
                  inputProps={{ min: formData.startDate }}
                />
              </Grid>

              {/* Product Selection Section */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  📦 Select Products & Set Margin %
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Select products for this scheme and set individual margin percentages
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  label="Search Product"
                  placeholder="Type product name to filter..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  sx={{ mb: 1.5 }}
                />
                
                <Paper sx={{ maxHeight: 400, overflow: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            indeterminate={
                              selectedProducts.filter(p => p.selected).length > 0 &&
                              selectedProducts.filter(p => p.selected).length < selectedProducts.length
                            }
                            checked={
                              selectedProducts.length > 0 &&
                              selectedProducts.filter(p => p.selected).length === selectedProducts.length
                            }
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectedProducts(prev => 
                                prev.map(product => ({ ...product, selected: checked }))
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell>Product Name</TableCell>
                        <TableCell align="right">Cost Price</TableCell>
                        <TableCell align="right">Selling Price</TableCell>
                        <TableCell align="right">Margin %</TableCell>
                        <TableCell align="right">Margin ₹</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredProducts.map((product) => {
                        const marginValue = product.costPrice > 0 && product.sellingPrice > 0
                          ? ((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100
                          : 0;
                        
                        return (
                          <TableRow key={product.productId}>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={product.selected}
                                onChange={() => handleProductToggle(product.productId)}
                              />
                            </TableCell>
                            <TableCell>{product.productName}</TableCell>
                            <TableCell align="right">₹{product.costPrice.toFixed(2)}</TableCell>
                            <TableCell align="right">₹{product.sellingPrice.toFixed(2)}</TableCell>
                            <TableCell align="right">
                              <TextField
                                type="number"
                                size="small"
                                value={product.marginPercentage}
                                onChange={(e) => handleMarginChange(product.productId, Number(e.target.value))}
                                disabled={!product.selected}
                                inputProps={{ min: 0.1, max: 100, step: 0.1, style: { width: '80px' } }}
                                sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color={product.selected ? 'success.main' : 'text.secondary'}>
                                {product.selected && product.marginPercentage > 0
                                  ? `₹${(product.sellingPrice * product.marginPercentage / 100).toFixed(2)}`
                                  : '-'
                                }
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Paper>
              </Grid>

              {formData.giftCost && getCurrentTarget() > 0 && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                    <Typography variant="h6" gutterBottom>
                      🧮 Auto-Calculated Target
                    </Typography>
                    <Typography variant="body1">
                      <strong>Billing Target:</strong> ₹{getCurrentTarget().toLocaleString()}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Formula: Gift Cost ÷ Average Margin % = {formData.giftCost} ÷ {
                        selectedProducts.filter(p => p.selected).length > 0
                          ? (selectedProducts.filter(p => p.selected).reduce((sum, p) => sum + p.marginPercentage, 0) / selectedProducts.filter(p => p.selected).length).toFixed(1)
                          : '0'
                      }% = ₹{getCurrentTarget().toLocaleString()}
                    </Typography>
                    <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                      Based on {selectedProducts.filter(p => p.selected).length} selected products
                    </Typography>
                  </Paper>
                </Grid>
              )}

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleCreateScheme}
                  disabled={loading || !formData.retailerId || !formData.giftCost || selectedProducts.filter(p => p.selected).length === 0}
                  startIcon={<AddIcon />}
                  fullWidth
                >
                  {loading ? 'Creating...' : 'Create Smart Scheme'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Typography variant="h6" gutterBottom>
          📊 Auto Margin Engine
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>Auto Margin Engine Active!</strong><br />
          Margin is automatically fetched from product master cost price. No manual entry required.
        </Alert>

        <Card>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Selected Products Summary
            </Typography>
            {selectedProducts.filter(p => p.selected).length > 0 ? (
              <Box>
                <Typography variant="body2" gutterBottom>
                  <strong>Products Selected:</strong> {selectedProducts.filter(p => p.selected).length}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Average Margin:</strong> {
                    selectedProducts.filter(p => p.selected).length > 0
                      ? (selectedProducts.filter(p => p.selected).reduce((sum, p) => sum + p.marginPercentage, 0) / selectedProducts.filter(p => p.selected).length).toFixed(1)
                      : '0'
                  }%
                </Typography>
                <Typography variant="body2">
                  <strong>Target Calculation:</strong> ₹{getCurrentTarget().toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  <strong>Scheme For:</strong> {formData.appliesTo}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No products selected yet
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // Render Dashboard Tab
  const renderDashboard = () => (
    <RetailerSchemeDashboard />
  );

  // Render Overdue Tracker Tab
  const renderOverdueTracker = () => (
    <OverdueTracker />
  );

  // Render Payment Tab
  const renderPayment = () => (
    <OverdueTracker />
  );

  // Render Achievement Tab
  const renderAchievement = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        🏆 Scheme Achievements
      </Typography>

      <Alert severity="success" sx={{ mb: 3 }}>
        <strong>Achievement System</strong><br />
        Monitor scheme completion and retailer performance.
      </Alert>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Scheme</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Applies To</TableCell>
              <TableCell align="right">Target</TableCell>
              <TableCell align="right">Gift Cost</TableCell>
              <TableCell align="right">Margin Burn %</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schemes.map((scheme) => {
              const statusCfg = getStatusConfig(scheme.isFrozen ? 'FROZEN' : 'GREEN');
              return (
                <TableRow key={scheme.id} hover>
                  <TableCell>{scheme.name}</TableCell>
                  <TableCell>
                    <Chip size="small" color={statusCfg.color as any} label={statusCfg.label} />
                  </TableCell>
                  <TableCell align="center">{scheme.appliesTo}</TableCell>
                  <TableCell align="right">₹{Number(scheme.calculatedTarget || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">₹{Number(scheme.giftCost || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(scheme.marginBurnPercentage || 0).toFixed(2)}%</TableCell>
                </TableRow>
              );
            })}
            {schemes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    No smart schemes found yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );

  if (loading && schemes.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        🚀 Smart Scheme Engine
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Create intelligent schemes with auto margin calculation, smart target logic, and payment-linked status tracking
      </Typography>

      <Divider sx={{ my: 3 }} />

      {/* Tab Navigation */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant={activeTab === 'create' ? 'contained' : 'outlined'}
          onClick={() => setActiveTab('create')}
          sx={{ mr: 2 }}
          startIcon={<AddIcon />}
        >
          Create Scheme
        </Button>
        <Button
          variant={activeTab === 'dashboard' ? 'contained' : 'outlined'}
          onClick={() => setActiveTab('dashboard')}
          sx={{ mr: 2 }}
          startIcon={<AssessmentIcon />}
        >
          Retailer Dashboard
        </Button>
        <Button
          variant={activeTab === 'payment' ? 'contained' : 'outlined'}
          onClick={() => setActiveTab('payment')}
          sx={{ mr: 2 }}
          startIcon={<PaymentIcon />}
        >
          Payment
        </Button>
        <Button
          variant={activeTab === 'achievement' ? 'contained' : 'outlined'}
          onClick={() => setActiveTab('achievement')}
          startIcon={<CheckCircleIcon />}
        >
          Achievement
        </Button>
      </Box>

      {/* Tab Content */}
      {activeTab === 'create' && renderCreateScheme()}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'payment' && renderPayment()}
      {activeTab === 'achievement' && renderAchievement()}
    </Box>
  );
};

export default SmartSchemeEngine;
