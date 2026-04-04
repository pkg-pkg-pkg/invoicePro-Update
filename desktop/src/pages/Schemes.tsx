import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Alert,
  Chip,
  CircularProgress,
  Paper,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AssessmentIcon from '@mui/icons-material/Assessment';

import { usePermissions } from '../hooks/usePermissions';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import {
  fetchSchemes,
  createScheme,
  updateScheme,
  deleteScheme,
  setSelectedScheme,
  toggleSchemes,
} from '../store/slices/schemeSlice';
import type { Scheme } from '../services/schemeService';
import { inventoryItemService } from '../services/masters/inventoryItemService';
import type { InventoryItem } from '../types/masters';
import SchemeForm from '../components/SchemeForm';
import SmartSchemeEngine from './Schemes/SmartSchemeEngine';

export default function Schemes() {
  const { isAdmin } = usePermissions();
  const dispatch = useDispatch<AppDispatch>();
  const [activeTab, setActiveTab] = useState(0); // 0 = Traditional, 1 = Smart Scheme Engine

  const { items: schemes, loading, creating, updating, deleting, error, isEnabled } = useSelector(
    (s: RootState) => s.schemes
  );

  const auth = useSelector((s: RootState) => s.auth);
  const companyId = (auth as any)?.user?.companyId || (auth as any)?.company?.id;

  const [openForm, setOpenForm] = useState(false);
  const [editingScheme, setEditingScheme] = useState<Scheme | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  useEffect(() => {
    if (companyId) {
      dispatch(fetchSchemes({ companyId }));
    }
  }, [dispatch, companyId]);

  // Fetch products for scheme selection
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setProductsLoading(true);
        const items = await inventoryItemService.list({ includeInactive: false });
        // Filter for active products only
        const activeProducts = items.filter((item) => item.status === 'ACTIVE');
        setProducts(activeProducts);
      } catch (err) {
        console.error('Error loading products:', err);
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();
  }, []);

  const handleCreateNew = () => {
    setEditingScheme(null);
    setOpenForm(true);
  };

  const handleEdit = (scheme: Scheme) => {
    setEditingScheme(scheme);
    setOpenForm(true);
  };

  const handleFormClose = () => {
    setOpenForm(false);
    setEditingScheme(null);
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      if (editingScheme) {
        // Update existing
        await dispatch(
          updateScheme({
            schemeId: editingScheme.id,
            data: formData,
          })
        );
      } else {
        // Create new
        await dispatch(
          createScheme({
            ...formData,
            companyId,
          })
        );
      }
      handleFormClose();
    } catch (err) {
      console.error('Error saving scheme:', err);
    }
  };

  const handleDeleteClick = (schemeId: string) => {
    setDeleteConfirm(schemeId);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirm) {
      await dispatch(deleteScheme({ schemeId: deleteConfirm }));
      setDeleteConfirm(null);
    }
  };

  const getSchemeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      BUY_X_GET_Y: 'Buy X Get Y',
      FLAT_DISCOUNT: 'Flat Discount',
      PERCENT_DISCOUNT: '% Discount',
      EXTRA_QUANTITY: 'Extra Quantity',
    };
    return labels[type] || type;
  };

  const getAppliesToLabel = (appliesTo: string) => {
    const labels: Record<string, string> = {
      SALES: 'Sales Only',
      PURCHASE: 'Purchase Only',
      BOTH: 'Both Sales & Purchase',
    };
    return labels[appliesTo] || appliesTo;
  };

  const getAppliesToColor = (appliesTo: string) => {
    const colors: Record<string, any> = {
      SALES: 'success',
      PURCHASE: 'warning',
      BOTH: 'info',
    };
    return colors[appliesTo] || 'default';
  };

  const isExpired = (endDateStr: string) => {
    const endDate = new Date(endDateStr);
    const today = new Date();
    return today > endDate;
  };

  const isActive = (scheme: Scheme) => {
    const today = new Date();
    const startDate = new Date(scheme.startDate);
    const endDate = new Date(scheme.endDate);
    return scheme.isActive && today >= startDate && today <= endDate;
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            Schemes & Offers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage product-wise schemes for Sales and Purchase
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Tab Navigation */}
      <Box sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab 
            label="Traditional Schemes" 
            icon={<AssessmentIcon />}
            iconPosition="start"
          />
          <Tab 
            label="🚀 Smart Scheme Engine" 
            icon={<RocketLaunchIcon />}
            iconPosition="start"
            sx={{ 
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              color: 'white !important',
              borderRadius: 1,
              ml: 1,
              '&:hover': {
                background: 'linear-gradient(135deg, #7c3aed 0%, #0891b2 100%)',
              }
            }}
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && (
        <>
          {/* Traditional Schemes Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Traditional Product Schemes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Classic product-wise schemes (Buy X Get Y, Discounts, etc.)
              </Typography>
            </Box>
            {isAdmin && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateNew}
                disabled={loading || !companyId}
              >
                New Scheme
              </Button>
            )}
          </Box>

          {/* Scheme Toggle */}
          <Box sx={{ mb: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isEnabled}
                  onChange={(e) => dispatch(toggleSchemes(e.target.checked))}
                  disabled={loading}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight="500">
                    {isEnabled ? '✓ Schemes Enabled' : '✗ Schemes Disabled'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isEnabled ? 'Schemes will be offered in transactions' : 'Schemes will not be shown'}
                  </Typography>
                </Box>
              }
            />
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" onClose={() => {}} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Loading State */}
          {loading && (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
              <CircularProgress />
            </Box>
          )}

          {/* Empty State */}
          {!loading && schemes.length === 0 && (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              {!isEnabled ? (
                <>
                  <Typography color="warning.main" fontWeight="500" gutterBottom>
                    Schemes are currently disabled
                  </Typography>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    No applicable schemes will be shown in transactions. Toggle above to enable.
                  </Typography>
                </>
              ) : (
                <>
                  <Typography color="text.secondary" gutterBottom>
                    No schemes created yet
                  </Typography>
                  {isAdmin && (
                    <Button variant="contained" onClick={handleCreateNew} sx={{ mt: 2 }}>
                      Create Your First Scheme
                    </Button>
                  )}
                </>
              )}
            </Paper>
          )}

          {/* Schemes Table */}
          {!loading && schemes.length > 0 && (
            <Paper>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Scheme Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Products</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Applies To</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Valid Period</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Status</TableCell>
                    {isAdmin && <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(schemes || []).map((scheme) => (
                    <TableRow
                      key={scheme.id}
                      hover
                      onClick={() => dispatch(setSelectedScheme(scheme))}
                      sx={{ cursor: 'pointer' }}
                    >
                      {/* Scheme Name */}
                      <TableCell>
                        <Box>
                          <Typography fontWeight="500">{scheme.name}</Typography>
                        </Box>
                      </TableCell>

                      {/* Type */}
                      <TableCell>
                        <Chip
                          label={getSchemeTypeLabel(scheme.schemeType)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>

                      {/* Products */}
                      <TableCell>
                        <Box display="flex" gap={1} flexWrap="wrap">
                          {scheme.products?.length ?? 0 > 0 ? (
                            <>
                              {scheme.products?.slice(0, 2).map((sp) => (
                                <Chip
                                  key={sp.id}
                                  label={sp.product?.name || sp.productId}
                                  size="small"
                                  variant="outlined"
                                />
                              ))}
                              {(scheme.products?.length ?? 0) > 2 && (
                                <Chip
                                  label={`+${(scheme.products?.length ?? 0) - 2} more`}
                                  size="small"
                                  variant="filled"
                                />
                              )}
                            </>
                          ) : (
                            <Typography color="error" variant="body2">
                              No products
                            </Typography>
                          )}
                        </Box>
                      </TableCell>

                      {/* Applies To */}
                      <TableCell>
                        <Chip
                          label={getAppliesToLabel(scheme.appliesTo)}
                          size="small"
                          color={getAppliesToColor(scheme.appliesTo) as any}
                          variant="filled"
                        />
                      </TableCell>

                      {/* Valid Period */}
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {new Date(scheme.startDate).toLocaleDateString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            to {new Date(scheme.endDate).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Status */}
                      <TableCell align="center">
                        {isExpired(scheme.endDate) ? (
                          <Chip label="Expired" color="error" size="small" />
                        ) : isActive(scheme) ? (
                          <Chip label="Active" color="success" size="small" />
                        ) : (
                          <Chip label="Inactive" color="default" size="small" />
                        )}
                      </TableCell>

                      {/* Actions */}
                      {isAdmin && (
                        <TableCell align="center">
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(scheme);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(scheme.id);
                            }}
                            disabled={deleting}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* Scheme Form Dialog */}
          <SchemeForm
            open={openForm}
            onClose={handleFormClose}
            onSubmit={handleFormSubmit}
            initialData={editingScheme}
            isLoading={creating || updating || productsLoading}
            products={products}
          />

          {/* Delete Confirmation Dialog */}
          <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
            <DialogTitle>Delete Scheme</DialogTitle>
            <DialogContent>
              <Typography>Are you sure you want to delete this scheme? This action cannot be undone.</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button
                color="error"
                variant="contained"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                Delete
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

      {activeTab === 1 && <SmartSchemeEngine />}
    </Box>
  );
}

