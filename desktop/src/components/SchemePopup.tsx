import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Grid
} from '@mui/material';
import { CheckCircle as CheckCircleIcon, Info as InfoIcon } from '@mui/icons-material';

interface SchemePopupProps {
  open: boolean;
  scheme: any;
  productName?: string;
  onApply: () => void;
  onSkip: () => void;
  isLoading?: boolean;
}

const SchemePopup: React.FC<SchemePopupProps> = ({
  open,
  scheme,
  productName,
  onApply,
  onSkip,
  isLoading = false
}) => {
  if (!scheme) return null;

  const getSchemeDescription = () => {
    const details = scheme.schemeDetails || {};
    switch (scheme.schemeType) {
      case 'BUY_X_GET_Y':
        return `Buy ${details.buyQuantity} Get ${details.getQuantity}`;
      case 'EXTRA_QUANTITY':
        return `Buy ${details.buyQuantity} Get ${details.extraQty} Extra Free`;
      case 'PERCENT_DISCOUNT':
        return `${details.discountPercent}% Discount`;
      case 'FLAT_DISCOUNT':
        return `Rs ${details.discountAmount} Off`;
      default:
        return 'Special Offer';
    }
  };

  const getSchemeIcon = () => {
    return <CheckCircleIcon sx={{ color: 'success.main', fontSize: 40, mb: 1 }} />;
  };

  return (
    <Dialog open={open} onClose={onSkip} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: 'success.light', display: 'flex', alignItems: 'center', gap: 1 }}>
        <InfoIcon />
        Active Offer Available!
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Icon */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            {getSchemeIcon()}
          </Box>

          {/* Scheme Details Card */}
          <Card sx={{ bgcolor: '#f5f5f5', border: '2px solid #4caf50' }}>
            <CardContent>
              <Grid container spacing={2}>
                {/* Scheme Name */}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
                    {scheme.name}
                  </Typography>
                </Grid>

                {/* Product */}
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="textSecondary">
                    Product
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {productName}
                  </Typography>
                </Grid>

                {/* Scheme Benefit */}
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="textSecondary">
                    Offer
                  </Typography>
                  <Chip
                    label={getSchemeDescription()}
                    color="success"
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                </Grid>

                {/* Valid Till */}
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">
                    Valid Till
                  </Typography>
                  <Typography variant="body2">
                    {new Date(scheme.endDate).toLocaleDateString('en-IN')}
                  </Typography>
                </Grid>

                {/* Applies To */}
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">
                    Applies To
                  </Typography>
                  <Box>
                    <Chip
                      label={scheme.appliesTo === 'BOTH' ? 'Sales & Purchase' : scheme.appliesTo}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Message */}
          <Typography variant="body2" sx={{ color: '#666', textAlign: 'center', fontStyle: 'italic' }}>
            Would you like to apply this offer to this product?
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={onSkip}
          variant="outlined"
          disabled={isLoading}
        >
          Skip This Time
        </Button>
        <Button
          onClick={onApply}
          variant="contained"
          color="success"
          disabled={isLoading}
          sx={{ fontWeight: 'bold' }}
        >
          ✓ Apply Scheme
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SchemePopup;
