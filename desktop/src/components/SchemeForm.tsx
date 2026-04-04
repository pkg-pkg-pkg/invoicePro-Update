import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Button,
  Box,
  Typography,
  Alert,
  Chip,
  Paper
} from '@mui/material';

interface SchemeFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: SchemeFormData) => void;
  products: any[];
  isLoading?: boolean;
  initialData?: any;
}

export interface SchemeFormData {
  name: string;
  schemeType: 'BUY_X_GET_Y' | 'FLAT_DISCOUNT' | 'PERCENT_DISCOUNT' | 'EXTRA_QUANTITY';
  appliesTo: 'SALES' | 'PURCHASE' | 'BOTH';
  startDate: Date;
  endDate: Date;
  productIds: string[];
  isActive: boolean;
  schemeDetails: {
    buyQuantity?: number;
    getQuantity?: number;
    extraQty?: number;
    discountPercent?: number;
    discountAmount?: number;
  };
}

const SchemeForm: React.FC<SchemeFormProps> = ({
  open,
  onClose,
  onSubmit,
  products,
  isLoading = false,
  initialData
}) => {
  const [formData, setFormData] = useState<SchemeFormData>({
    name: '',
    schemeType: 'BUY_X_GET_Y',
    appliesTo: 'SALES',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    productIds: [],
    isActive: true,
    schemeDetails: {}
  });

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [brandFilter, setBrandFilter] = useState<string>('');

  // Extract unique categories and brands for filtering
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [products]);

  const brands = useMemo(() => {
    const filtered = categoryFilter 
      ? products.filter(p => p.category === categoryFilter)
      : products;
    const brds = new Set(filtered.map(p => p.brandName).filter(Boolean));
    return Array.from(brds).sort();
  }, [products, categoryFilter]);

  // Filter products based on selected category and brand
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (brandFilter && p.brandName !== brandFilter) return false;
      return true;
    });
  }, [products, categoryFilter, brandFilter]);

  // Format product display: ItemName > Category > BrandName
  const getProductLabel = (product: any) => {
    const parts = [product.name, product.category, product.brandName].filter(Boolean);
    return parts.join(' > ');
  };

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setSelectedProducts(initialData.productIds || []);
    }
  }, [initialData]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Scheme name required';
    if (selectedProducts.length === 0) newErrors.products = 'Select at least one product';
    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      newErrors.dates = 'End date must be after start date';
    }

    switch (formData.schemeType) {
      case 'BUY_X_GET_Y':
        if (!formData.schemeDetails.buyQuantity || formData.schemeDetails.buyQuantity < 1) {
          newErrors.buyQuantity = 'Buy quantity required (min 1)';
        }
        if (!formData.schemeDetails.getQuantity || formData.schemeDetails.getQuantity < 1) {
          newErrors.getQuantity = 'Get quantity required (min 1)';
        }
        break;
      case 'EXTRA_QUANTITY':
        if (!formData.schemeDetails.buyQuantity || formData.schemeDetails.buyQuantity < 1) {
          newErrors.buyQuantity = 'Buy quantity required (min 1)';
        }
        if (!formData.schemeDetails.extraQty || formData.schemeDetails.extraQty < 1) {
          newErrors.extraQty = 'Extra quantity required (min 1)';
        }
        break;
      case 'PERCENT_DISCOUNT':
        if (!formData.schemeDetails.discountPercent || formData.schemeDetails.discountPercent <= 0) {
          newErrors.discount = 'Discount % required (> 0)';
        }
        if ((formData.schemeDetails.discountPercent ?? 0) > 100) {
          newErrors.discount = 'Discount % cannot exceed 100';
        }
        break;
      case 'FLAT_DISCOUNT':
        if (!formData.schemeDetails.discountAmount || formData.schemeDetails.discountAmount <= 0) {
          newErrors.discount = 'Discount amount required (> 0)';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit({
        ...formData,
        productIds: selectedProducts
      });
    }
  };

  const handleProductToggle = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initialData ? 'Edit Scheme' : 'Create New Scheme'}
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Scheme Name */}
          <TextField
            label="Scheme Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={!!errors.name}
            helperText={errors.name}
            placeholder="e.g., Buy 10 Get 1, Diwali 15% Off"
            fullWidth
          />

          {/* Scheme Type */}
          <FormControl fullWidth error={!!errors.schemeType}>
            <InputLabel>Scheme Type</InputLabel>
            <Select
              value={formData.schemeType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  schemeType: e.target.value as SchemeFormData['schemeType'],
                  schemeDetails: {}
                })
              }
              label="Scheme Type"
            >
              <MenuItem value="BUY_X_GET_Y">Buy X Get Y</MenuItem>
              <MenuItem value="EXTRA_QUANTITY">Extra Quantity</MenuItem>
              <MenuItem value="PERCENT_DISCOUNT">Percentage Discount (%)</MenuItem>
              <MenuItem value="FLAT_DISCOUNT">Flat Discount (Amount)</MenuItem>
            </Select>
          </FormControl>

          {/* Scheme Details based on Type */}
          <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Scheme Details
            </Typography>

            {formData.schemeType === 'BUY_X_GET_Y' && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="Buy Quantity"
                  type="number"
                  value={formData.schemeDetails.buyQuantity || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      schemeDetails: {
                        ...formData.schemeDetails,
                        buyQuantity: parseInt(e.target.value)
                      }
                    })
                  }
                  error={!!errors.buyQuantity}
                  helperText={errors.buyQuantity}
                  inputProps={{ min: 1 }}
                  size="small"
                />
                <TextField
                  label="Get Quantity"
                  type="number"
                  value={formData.schemeDetails.getQuantity || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      schemeDetails: {
                        ...formData.schemeDetails,
                        getQuantity: parseInt(e.target.value)
                      }
                    })
                  }
                  error={!!errors.getQuantity}
                  helperText={errors.getQuantity}
                  inputProps={{ min: 1 }}
                  size="small"
                />
              </Box>
            )}

            {formData.schemeType === 'EXTRA_QUANTITY' && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="Buy Quantity"
                  type="number"
                  value={formData.schemeDetails.buyQuantity || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      schemeDetails: {
                        ...formData.schemeDetails,
                        buyQuantity: parseInt(e.target.value)
                      }
                    })
                  }
                  error={!!errors.buyQuantity}
                  inputProps={{ min: 1 }}
                  size="small"
                />
                <TextField
                  label="Extra Qty"
                  type="number"
                  value={formData.schemeDetails.extraQty || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      schemeDetails: {
                        ...formData.schemeDetails,
                        extraQty: parseInt(e.target.value)
                      }
                    })
                  }
                  error={!!errors.extraQty}
                  inputProps={{ min: 1 }}
                  size="small"
                />
              </Box>
            )}

            {formData.schemeType === 'PERCENT_DISCOUNT' && (
              <TextField
                label="Discount %"
                type="number"
                value={formData.schemeDetails.discountPercent || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    schemeDetails: {
                      ...formData.schemeDetails,
                      discountPercent: parseFloat(e.target.value)
                    }
                  })
                }
                error={!!errors.discount}
                helperText={errors.discount}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                fullWidth
                size="small"
              />
            )}

            {formData.schemeType === 'FLAT_DISCOUNT' && (
              <TextField
                label="Discount Amount (Rs)"
                type="number"
                value={formData.schemeDetails.discountAmount || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    schemeDetails: {
                      ...formData.schemeDetails,
                      discountAmount: parseFloat(e.target.value)
                    }
                  })
                }
                error={!!errors.discount}
                helperText={errors.discount}
                inputProps={{ min: 0, step: 0.01 }}
                fullWidth
                size="small"
              />
            )}
          </Paper>

          {/* Applies To */}
          <FormControl fullWidth>
            <InputLabel>Applies To</InputLabel>
            <Select
              value={formData.appliesTo}
              onChange={(e) => setFormData({ ...formData, appliesTo: e.target.value as any })}
              label="Applies To"
            >
              <MenuItem value="SALES">Sales Only</MenuItem>
              <MenuItem value="PURCHASE">Purchase Only</MenuItem>
              <MenuItem value="BOTH">Both Sales & Purchase</MenuItem>
            </Select>
          </FormControl>

          {/* Dates */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Start Date"
              type="date"
              value={formData.startDate.toISOString().split('T')[0]}
              onChange={(e: any) =>
                setFormData({
                  ...formData,
                  startDate: new Date(e.target.value)
                })
              }
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              type="date"
              value={formData.endDate.toISOString().split('T')[0]}
              onChange={(e: any) =>
                setFormData({
                  ...formData,
                  endDate: new Date(e.target.value)
                })
              }
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          {errors.dates && <Alert severity="error">{errors.dates}</Alert>}

          {/* Product Selection with Filters */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Applicable Products ✓
            </Typography>
            {errors.products && <Alert severity="error" sx={{ mb: 2 }}>{errors.products}</Alert>}

            {/* Category Filter */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Filter by Category</InputLabel>
              <Select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setBrandFilter(''); // Reset brand filter when category changes
                }}
                label="Filter by Category"
              >
                <MenuItem value="">All Categories</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Brand Filter */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Filter by Brand</InputLabel>
              <Select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                label="Filter by Brand"
              >
                <MenuItem value="">All Brands</MenuItem>
                {brands.map((brand) => (
                  <MenuItem key={brand} value={brand}>
                    {brand}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Product List with Checkbox */}
            <FormGroup sx={{ maxHeight: 250, overflow: 'auto', border: '1px solid #ddd', p: 1.5, borderRadius: 1, bgcolor: '#fafafa' }}>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <FormControlLabel
                    key={product.id}
                    control={
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleProductToggle(product.id)}
                      />
                    }
                    label={getProductLabel(product)}
                    sx={{ mb: 0.5 }}
                  />
                ))
              ) : (
                <Typography variant="body2" sx={{ color: '#999', p: 1 }}>
                  No products found with selected filters
                </Typography>
              )}
            </FormGroup>

            {/* Selected Products Display */}
            {selectedProducts.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{ color: '#666', mb: 1, display: 'block' }}>
                  Selected: {selectedProducts.length} product(s)
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {selectedProducts.map((productId) => {
                    const product = products.find((p) => p.id === productId);
                    return (
                      <Chip
                        key={productId}
                        label={getProductLabel(product)}
                        size="small"
                        onDelete={() => handleProductToggle(productId)}
                        sx={{ bgcolor: '#e3f2fd' }}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>

          {/* Active Status */}
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
            }
            label="Active"
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Scheme'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SchemeForm;
