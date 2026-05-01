import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
// Using native date input instead of DatePicker for simplicity
import { gstService, HSNSummaryResponse } from '../../services/gstService';

export default function HSNSummary() {
  const [fromDate, setFromDate] = useState<Date | null>(new Date(new Date().getFullYear(), 0, 1));
  const [toDate, setToDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HSNSummaryResponse | null>(null);

  const handleGenerate = async () => {
    if (!fromDate || !toDate) {
      setError('Please select both from and to dates');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await gstService.getHSNSummary(
        fromDate.toISOString().split('T')[0],
        toDate.toISOString().split('T')[0]
      );
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate HSN summary');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        HSN Summary Report
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              label="From Date"
              type="date"
              value={fromDate ? fromDate.toISOString().split('T')[0] : ''}
              onChange={(e) => setFromDate(e.target.value ? new Date(e.target.value) : null)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="To Date"
              type="date"
              value={toDate ? toDate.toISOString().split('T')[0] : ''}
              onChange={(e) => setToDate(e.target.value ? new Date(e.target.value) : null)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={loading}
              fullWidth
            >
              {loading ? <CircularProgress size={24} /> : 'Generate Report'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {data && (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Total HSN Rows</Typography>
                  <Typography variant="h6">{data.hsnSummary.length}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">B2B HSN Rows</Typography>
                  <Typography variant="h6">{(data.b2bHsnSummary || []).length}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">B2C HSN Rows</Typography>
                  <Typography variant="h6">{(data.b2cHsnSummary || []).length}</Typography>
                </Paper>
              </Grid>
            </Grid>

            <Paper sx={{ p: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>HSN Summary - All</Typography>
              <Divider sx={{ mb: 1 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>HSN Code</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">UQC</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Taxable Value</TableCell>
                      <TableCell align="right">IGST</TableCell>
                      <TableCell align="right">CGST</TableCell>
                      <TableCell align="right">SGST</TableCell>
                      <TableCell align="right">Total Tax</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.hsnSummary.map((item, index) => (
                      <TableRow key={`all-${index}`}>
                        <TableCell>{item.hsnCode}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell align="right">{Number(item.quantity).toFixed(2)}</TableCell>
                        <TableCell align="right">{item.uqc}</TableCell>
                        <TableCell align="right">₹{Number(item.rate).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(item.taxableValue).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(item.igst).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(item.cgst).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(item.sgst).toFixed(2)}</TableCell>
                        <TableCell align="right">₹{Number(item.totalTax).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12} lg={6}>
                <Paper sx={{ p: 1.5 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>HSN Summary - B2B</Typography>
                  <Divider sx={{ mb: 1 }} />
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>HSN</TableCell>
                          <TableCell align="right">Taxable</TableCell>
                          <TableCell align="right">IGST</TableCell>
                          <TableCell align="right">CGST</TableCell>
                          <TableCell align="right">SGST</TableCell>
                          <TableCell align="right">Tax</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(data.b2bHsnSummary || []).length === 0 ? (
                          <TableRow><TableCell colSpan={6} align="center">No B2B HSN data</TableCell></TableRow>
                        ) : (
                          (data.b2bHsnSummary || []).map((item, idx) => (
                            <TableRow key={`b2b-${idx}`}>
                              <TableCell>{item.hsnCode}</TableCell>
                              <TableCell align="right">₹{Number(item.taxableValue).toFixed(2)}</TableCell>
                              <TableCell align="right">₹{Number(item.igst).toFixed(2)}</TableCell>
                              <TableCell align="right">₹{Number(item.cgst).toFixed(2)}</TableCell>
                              <TableCell align="right">₹{Number(item.sgst).toFixed(2)}</TableCell>
                              <TableCell align="right">₹{Number(item.totalTax).toFixed(2)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
              <Grid item xs={12} lg={6}>
                <Paper sx={{ p: 1.5 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>HSN Summary - B2C</Typography>
                  <Divider sx={{ mb: 1 }} />
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>HSN</TableCell>
                          <TableCell align="right">Taxable</TableCell>
                          <TableCell align="right">IGST</TableCell>
                          <TableCell align="right">CGST</TableCell>
                          <TableCell align="right">SGST</TableCell>
                          <TableCell align="right">Tax</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(data.b2cHsnSummary || []).length === 0 ? (
                          <TableRow><TableCell colSpan={6} align="center">No B2C HSN data</TableCell></TableRow>
                        ) : (
                          (data.b2cHsnSummary || []).map((item, idx) => (
                            <TableRow key={`b2c-${idx}`}>
                              <TableCell>{item.hsnCode}</TableCell>
                              <TableCell align="right">₹{Number(item.taxableValue).toFixed(2)}</TableCell>
                              <TableCell align="right">₹{Number(item.igst).toFixed(2)}</TableCell>
                              <TableCell align="right">₹{Number(item.cgst).toFixed(2)}</TableCell>
                              <TableCell align="right">₹{Number(item.sgst).toFixed(2)}</TableCell>
                              <TableCell align="right">₹{Number(item.totalTax).toFixed(2)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}
      </Box>
  );
}

