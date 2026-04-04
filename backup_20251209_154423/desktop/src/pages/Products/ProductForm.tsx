import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { AppDispatch, RootState } from '../../store';
import {
  fetchProduct,
  createProduct,
  updateProduct,
  fetchCategories,
  clearCurrentProduct,
  clearError,
} from '../../store/slices/productSlice';
import { Product } from '../../services/productService';

const UNITS = ['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Pack', 'Dozen', 'Gram', 'Ton', 'Quintal', 'Sqft', 'Sqmt'];
const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];

export default function ProductForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { currentProduct, categories, loading, error } = useSelector(
    (state: RootState) => state.products
  );

  const isEditMode = !!id;
  const [saveAndContinue, setSaveAndContinue] = useState(false);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    code: '',
    barcode: '',
    categoryId: '',
    hsnCode: '',
    sacCode: '',
    unit: 'Pcs',
    uqc: '',
    purchasePrice: 0,
    salePrice: 0,
    mrp: 0,
    wholesalePrice: 0,
    distributorPrice: 0,
    openingStock: 0,
    currentStock: 0,
    lowStockAlert: 0,
    trackBatch: false,
    trackSerial: false,
    trackExpiry: false,
    images: [],
    isActive: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dispatch(fetchCategories());
    
    if (isEditMode && id) {
      dispatch(fetchProduct(id));
    } else {
      dispatch(clearCurrentProduct());
    }

    return () => {
      dispatch(clearCurrentProduct());
    };
  }, [dispatch, id, isEditMode]);

  useEffect(() => {
    if (currentProduct && isEditMode) {
      setFormData({
        name: currentProduct.name,
        code: currentProduct.code,
        barcode: currentProduct.barcode || '',
        categoryId: currentProduct.categoryId || '',
        hsnCode: currentProduct.hsnCode || '',
        sacCode: currentProduct.sacCode || '',
        unit: currentProduct.unit,
        uqc: currentProduct.uqc || '',
        purchasePrice: Number(currentProduct.purchasePrice),
        salePrice: Number(currentProduct.salePrice),
        mrp: currentProduct.mrp ? Number(currentProduct.mrp) : 0,
        wholesalePrice: currentProduct.wholesalePrice ? Number(currentProduct.wholesalePrice) : 0,
        distributorPrice: currentProduct.distributorPrice ? Number(currentProduct.distributorPrice) : 0,
        openingStock: Number(currentProduct.openingStock),
        currentStock: Number(currentProduct.currentStock),
        lowStockAlert: Number(currentProduct.lowStockAlert),
        trackBatch: currentProduct.trackBatch,
        trackSerial: currentProduct.trackSerial,
        trackExpiry: currentProduct.trackExpiry,
        images: currentProduct.images || [],
        isActive: currentProduct.isActive,
      });
    }
  }, [currentProduct, isEditMode]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Product name is required (min 2 characters)';
    }

    if (!formData.unit) {
      newErrors.unit = 'Unit is required';
    }

    if (formData.purchasePrice !== undefined && formData.purchasePrice < 0) {
      newErrors.purchasePrice = 'Purchase price must be >= 0';
    }

    if (formData.salePrice !== undefined && formData.salePrice < 0) {
      newErrors.salePrice = 'Sale price must be >= 0';
    }

    if (formData.mrp !== undefined && formData.mrp < 0) {
      newErrors.mrp = 'MRP must be >= 0';
    }

    if (formData.openingStock !== undefined && formData.openingStock < 0) {
      newErrors.openingStock = 'Opening stock must be >= 0';
    }

    if (formData.lowStockAlert !== undefined && formData.lowStockAlert < 0) {
      newErrors.lowStockAlert = 'Low stock alert must be >= 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof Product, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      if (isEditMode && id) {
        await dispatch(updateProduct({ id, data: formData })).unwrap();
      } else {
        await dispatch(createProduct(formData)).unwrap();
      }

      if (saveAndContinue) {
        // Reset form for next entry
        setFormData({
          name: '',
          code: '',
          barcode: '',
          categoryId: '',
          hsnCode: '',
          sacCode: '',
          unit: 'Pcs',
          uqc: '',
          purchasePrice: 0,
          salePrice: 0,
          mrp: 0,
          wholesalePrice: 0,
          distributorPrice: 0,
          openingStock: 0,
          currentStock: 0,
          lowStockAlert: 0,
          trackBatch: false,
          trackSerial: false,
          trackExpiry: false,
          images: [],
          isActive: true,
        });
        setSaveAndContinue(false);
        // TODO: Show success toast
      } else {
        navigate('/products');
      }
    } catch (err) {
      // Error is handled by Redux
      console.error('Save error:', err);
    }
  };

  const calculateMargin = () => {
    if (formData.mrp && formData.purchasePrice) {
      const margin = ((Number(formData.mrp) - Number(formData.purchasePrice)) / Number(formData.purchasePrice)) * 100;
      return margin.toFixed(2);
    }
    return '0.00';
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/products')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">
          {isEditMode ? 'Edit Product' : 'Add Product'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Product Name *"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={!!errors.name}
                helperText={errors.name}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="SKU/Code"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                helperText="Leave empty to auto-generate"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Barcode"
                value={formData.barcode}
                onChange={(e) => handleChange('barcode', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.categoryId || ''}
                  onChange={(e) => handleChange('categoryId', e.target.value)}
                  label="Category"
                >
                  <MenuItem value="">None</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Unit *</InputLabel>
                <Select
                  value={formData.unit}
                  onChange={(e) => handleChange('unit', e.target.value)}
                  label="Unit *"
                  error={!!errors.unit}
                >
                  {UNITS.map((unit) => (
                    <MenuItem key={unit} value={unit}>
                      {unit}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="UQC Code"
                value={formData.uqc}
                onChange={(e) => handleChange('uqc', e.target.value)}
                helperText="Unit Quantity Code"
              />
            </Grid>

            {/* Pricing */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Pricing
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Purchase Price (₹)"
                type="number"
                value={formData.purchasePrice}
                onChange={(e) => handleChange('purchasePrice', parseFloat(e.target.value) || 0)}
                error={!!errors.purchasePrice}
                helperText={errors.purchasePrice}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Sale Price (₹)"
                type="number"
                value={formData.salePrice}
                onChange={(e) => handleChange('salePrice', parseFloat(e.target.value) || 0)}
                error={!!errors.salePrice}
                helperText={errors.salePrice}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="MRP (₹)"
                type="number"
                value={formData.mrp}
                onChange={(e) => handleChange('mrp', parseFloat(e.target.value) || 0)}
                error={!!errors.mrp}
                helperText={errors.mrp || `Margin: ${calculateMargin()}%`}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="HSN Code"
                value={formData.hsnCode}
                onChange={(e) => handleChange('hsnCode', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>GST Rate</InputLabel>
                <Select
                  value={formData.hsnCode ? 0 : 0} // TODO: Add GST rate field
                  onChange={(e) => {}}
                  label="GST Rate"
                >
                  {GST_RATES.map((rate) => (
                    <MenuItem key={rate} value={rate}>
                      {rate}%
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Stock */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Stock Management
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Opening Stock"
                type="number"
                value={formData.openingStock}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  handleChange('openingStock', value);
                  if (!isEditMode) {
                    handleChange('currentStock', value);
                  }
                }}
                error={!!errors.openingStock}
                helperText={errors.openingStock}
                inputProps={{ min: 0, step: 1 }}
                disabled={isEditMode}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Current Stock"
                type="number"
                value={formData.currentStock}
                onChange={(e) => handleChange('currentStock', parseFloat(e.target.value) || 0)}
                inputProps={{ min: 0, step: 1 }}
                disabled={isEditMode}
                helperText={isEditMode ? 'Stock can be adjusted from stock management' : ''}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Low Stock Alert"
                type="number"
                value={formData.lowStockAlert}
                onChange={(e) => handleChange('lowStockAlert', parseFloat(e.target.value) || 0)}
                error={!!errors.lowStockAlert}
                helperText={errors.lowStockAlert}
                inputProps={{ min: 0, step: 1 }}
              />
            </Grid>

            {/* Status */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Status
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => handleChange('isActive', e.target.checked)}
                  />
                }
                label="Active"
              />
            </Grid>

            {/* Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/products')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                {!isEditMode && (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setSaveAndContinue(true);
                      handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                    }}
                    disabled={loading}
                  >
                    Save & Continue
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  {loading ? 'Saving...' : 'Save'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
}

