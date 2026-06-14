import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Card, CardActionArea, CardContent } from '@mui/material';
import { Inventory as InventoryIcon, TrendingDown as TrendingDownIcon, TrendingUp as TrendingUpIcon } from '@mui/icons-material';

interface StockReportsProps {
  canExport: boolean;
}

export default function StockReports({ canExport: _canExport }: StockReportsProps) {
  const navigate = useNavigate();

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Stock Reports</Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/items')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <InventoryIcon color="primary" />
                  <Typography variant="subtitle1">Current Stock (Products)</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  View product list and stock-related fields
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/reports/low-stock')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TrendingDownIcon color="primary" />
                  <Typography variant="subtitle1">Low Stock</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Items below reorder threshold
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/items/adjustments')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TrendingUpIcon color="primary" />
                  <Typography variant="subtitle1">Stock Adjustments</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Inventory increase / decrease history
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
