import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  ShoppingCart as PurchaseIcon,
  CalendarViewMonth as MonthlyIcon,
  DateRange as AnnualIcon,
  Inventory as HSNIcon,
} from '@mui/icons-material';

interface GSTReport {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  status: 'available' | 'coming_soon';
  features: string[];
}

const gstReports: GSTReport[] = [
  {
    id: 'gstr1',
    title: 'GSTR-1 (Sales Return)',
    description: 'Monthly sales return with HSN-wise breakdown of outward supplies',
    icon: <ReceiptIcon fontSize="large" color="primary" />,
    path: '/gst/gstr1',
    status: 'available',
    features: ['B2B Invoices', 'B2C Invoices', 'HSN Summary', 'Export to JSON']
  },
  {
    id: 'gstr2',
    title: 'GSTR-2 (Purchase Return)',
    description: 'Monthly purchase return with HSN-wise breakdown of inward supplies',
    icon: <PurchaseIcon fontSize="large" color="warning" />,
    path: '/gst/gstr2',
    status: 'available',
    features: ['Purchase Bills', 'Input Tax Credit', 'HSN Summary']
  },
  {
    id: 'gstr3b',
    title: 'GSTR-3B (Monthly Return)',
    description: 'Simplified monthly return with outward and inward supplies summary',
    icon: <MonthlyIcon fontSize="large" color="success" />,
    path: '/gst/gstr3b',
    status: 'available',
    features: ['Outward Supplies', 'Inward Supplies', 'Tax Liability']
  },
  {
    id: 'gstr9',
    title: 'GSTR-9 (Annual Return)',
    description: 'Annual return with reconciliation of monthly returns and HSN-wise summary',
    icon: <AnnualIcon fontSize="large" color="info" />,
    path: '/gst/gstr9',
    status: 'available',
    features: ['Annual Summary', 'Monthly Reconciliation', 'HSN-wise Data', 'Export to JSON']
  },
  {
    id: 'hsn-summary',
    title: 'HSN Summary',
    description: 'Detailed HSN-wise summary of all transactions for GST compliance',
    icon: <HSNIcon fontSize="large" color="secondary" />,
    path: '/gst/hsn-summary',
    status: 'available',
    features: ['HSN-wise Breakdown', 'Tax Calculation', 'Export Options']
  }
];

export default function GSTReports() {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: { xs: 1.25, md: 1.75 } }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
        GST Reports
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.75 }}>
        Generate and manage all GST returns and summaries with HSN-wise data
      </Typography>

      <Grid container spacing={1.25}>
        {gstReports.map((report) => (
          <Grid item xs={12} md={6} lg={4} key={report.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                },
                opacity: report.status === 'coming_soon' ? 0.7 : 1,
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 1.5, '&:last-child': { pb: 1.25 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.25 }}>
                  {report.icon}
                  <Box sx={{ ml: 1.25 }}>
                    <Typography variant="subtitle1" component="div" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {report.title}
                    </Typography>
                    <Chip
                      label={report.status === 'available' ? 'Available' : 'Coming Soon'}
                      color={report.status === 'available' ? 'success' : 'default'}
                      size="small"
                      sx={{ mt: 0.35, height: 20, '& .MuiChip-label': { px: 0.8 } }}
                    />
                  </Box>
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ mb: 1.1, display: 'block' }}>
                  {report.description}
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {report.features.map((feature, index) => (
                    <Chip
                      key={index}
                      label={feature}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.66rem', height: 20 }}
                    />
                  ))}
                </Box>
              </CardContent>

              <CardActions sx={{ p: 1, pt: 0 }}>
                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  onClick={() => navigate(report.path)}
                  disabled={report.status === 'coming_soon'}
                >
                  {report.status === 'available' ? 'Generate Report' : 'Coming Soon'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
