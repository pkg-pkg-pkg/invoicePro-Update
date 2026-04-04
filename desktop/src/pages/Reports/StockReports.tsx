import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Card, CardActionArea, CardContent, Button } from '@mui/material';
import { Inventory as InventoryIcon, TrendingDown as TrendingDownIcon, TrendingUp as TrendingUpIcon, FileDownload as FileDownloadIcon } from '@mui/icons-material';

interface StockReportsProps {
  canExport: boolean;
}

export default function StockReports({ canExport }: StockReportsProps) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!canExport) {
      alert('You do not have permission to export reports');
      return;
    }
    setExporting(true);
    // ... export logic
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Stock Reports</Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/products')}>
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
            <CardActionArea onClick={() => navigate('/products')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TrendingDownIcon color="primary" />
                  <Typography variant="subtitle1">Low Stock</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Identify items that need reorder (from products)
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardActionArea onClick={() => navigate('/products')}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TrendingUpIcon color="primary" />
                  <Typography variant="subtitle1">Stock Movement</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Coming soon (will summarize purchases/sales by product)
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  disabled={!canExport || exporting}
                  onClick={handleExport}
                >
                  {exporting ? 'Exporting...' : 'Export to Excel'}
                </Button>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
