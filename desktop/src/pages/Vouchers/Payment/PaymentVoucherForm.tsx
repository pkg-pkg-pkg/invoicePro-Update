import { useState, useMemo } from 'react';
import { Alert, Box, Button, Card, CardContent, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, Checkbox } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import { voucherService } from '../../../services/vouchers/voucherService';
import { usePermission } from '../../../hooks/usePermission';
import { autoLedgerService } from '../../../services/masters/autoLedgerService';
import { 
  fetchOutstandingInvoices, 
  calculatePaymentTotals, 
  validatePaymentData, 
  buildPaymentVoucherLines,
  OutstandingInvoice,
  PaymentData 
} from '../../../services/payments/paymentService';

const PaymentVoucherForm = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreate = can('create-vouchers');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoice[]>([]);

  const [formState, setFormState] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    number: `PAY-${dayjs().format('YYYYMMDD-HHmmss')}`,
    partyName: '',
    partyLedgerId: '',
    narration: '',
  });

  const totals = useMemo(() => {
    return calculatePaymentTotals(outstandingInvoices);
  }, [outstandingInvoices]);

  const canSubmit =
    canCreate &&
    formState.date &&
    formState.number &&
    formState.partyLedgerId &&
    totals.totalPayment > 0 &&
    !saving;

  const handlePartySearch = async () => {
    if (!formState.partyName.trim()) {
      setError('Please enter a supplier name');
      return;
    }

    setLoadingInvoices(true);
    setError(null);

    try {
      // Create/find supplier ledger
      const ledgerId = await autoLedgerService.ensureSupplierLedger(formState.partyName.trim());
      
      if (!ledgerId) {
        setError('Supplier not found. Please check the name and try again.');
        return;
      }

      // Fetch outstanding invoices
      const invoices = await fetchOutstandingInvoices(ledgerId, 'SUPPLIER');
      
      setOutstandingInvoices(invoices);
      setFormState(prev => ({
        ...prev,
        partyLedgerId: ledgerId,
      }));

      // Auto-populate narration
      const invoiceNumbers = invoices.filter(inv => inv.balanceAmount > 0).slice(0, 3).map(inv => inv.number).join(', ');
      setFormState(prev => ({
        ...prev,
        narration: `Payment against ${invoiceNumbers}`,
      }));

    } catch (err) {
      setError('Failed to load outstanding invoices. Please try again.');
      console.error('Party search error:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const toggleInvoiceSelection = (invoiceId: string) => {
    setOutstandingInvoices(prev => 
      prev.map(invoice => 
        invoice.id === invoiceId 
          ? { ...invoice, isSelected: !invoice.isSelected }
          : invoice
      )
    );
  };

  const updatePaymentAmount = (invoiceId: string, amount: number) => {
    setOutstandingInvoices(prev => 
      prev.map(invoice => 
        invoice.id === invoiceId 
          ? { 
              ...invoice, 
              paymentAmount: Math.max(0, Math.min(amount, invoice.balanceAmount)),
              isSelected: amount > 0 
            }
          : invoice
      )
    );
  };

  const selectAllInvoices = () => {
    setOutstandingInvoices(prev => 
      prev.map(invoice => ({
        ...invoice,
        isSelected: true,
        paymentAmount: invoice.balanceAmount,
      }))
    );
  };

  const clearAllSelections = () => {
    setOutstandingInvoices(prev => 
      prev.map(invoice => ({
        ...invoice,
        isSelected: false,
        paymentAmount: 0,
      }))
    );
  };

  const postingPreview = useMemo(() => {
    if (!formState.partyLedgerId || totals.selectedInvoices.length === 0) return [];

    const paymentData: PaymentData = {
      partyLedgerId: formState.partyLedgerId,
      partyName: formState.partyName,
      partyType: 'SUPPLIER',
      paymentType: 'PAYMENT',
      date: formState.date,
      narration: formState.narration,
      totalAmount: totals.totalPayment,
      selectedInvoices: totals.selectedInvoices,
    };

    return buildPaymentVoucherLines(paymentData);
  }, [formState, totals]);

  const postingBalanced = useMemo(() => {
    const totalDebit = postingPreview.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredit = postingPreview.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    return Number(totalDebit.toFixed(2)) === Number(totalCredit.toFixed(2));
  }, [postingPreview]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!canSubmit) {
      setError('Please complete all required fields before saving.');
      return;
    }

    const paymentData: PaymentData = {
      partyLedgerId: formState.partyLedgerId,
      partyName: formState.partyName,
      partyType: 'SUPPLIER',
      paymentType: 'PAYMENT',
      date: formState.date,
      narration: formState.narration,
      totalAmount: totals.totalPayment,
      selectedInvoices: totals.selectedInvoices,
    };

    const validation = validatePaymentData(paymentData);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const voucherLines = postingPreview;
      
      await voucherService.create({
        type: 'PAYMENT',
        date: new Date(formState.date).toISOString(),
        number: formState.number,
        narration: formState.narration,
        lines: voucherLines,
      });
      
      navigate('/vouchers/payment-vouchers');
    } catch (err) {
      setError((err as Error).message ?? 'Failed to create payment voucher');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card component="form" onSubmit={handleSubmit}>
      <CardContent>
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="h5" fontWeight={600}>
                Payment Voucher
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Process supplier payments against outstanding invoices
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained" disabled={!canSubmit}>
                {saving ? 'Saving...' : 'Save Payment'}
              </Button>
            </Stack>
          </Stack>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={2}>
              <TextField
                label="Date"
                type="date"
                value={formState.date}
                onChange={(e) => setFormState((prev) => ({ ...prev, date: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                label="Voucher Number"
                value={formState.number}
                onChange={(e) => setFormState((prev) => ({ ...prev, number: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Supplier Name"
                  value={formState.partyName}
                  onChange={(e) => setFormState((prev) => ({ ...prev, partyName: e.target.value }))}
                  fullWidth
                  placeholder="Enter supplier name"
                />
                <Button
                  variant="outlined"
                  onClick={handlePartySearch}
                  disabled={loadingInvoices}
                  startIcon={<SearchIcon />}
                  sx={{ minWidth: '120px' }}
                >
                  {loadingInvoices ? 'Searching...' : 'Search'}
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Narration"
                value={formState.narration}
                onChange={(e) => setFormState((prev) => ({ ...prev, narration: e.target.value }))}
                fullWidth
                multiline
                rows={1}
              />
            </Grid>
          </Grid>

          {outstandingInvoices.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Outstanding Invoices ({totals.totalInvoices} selected)
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="text"
                      size="small"
                      onClick={selectAllInvoices}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={clearAllSelections}
                    >
                      Clear All
                    </Button>
                  </Stack>
                </Stack>
                
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 1000 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={outstandingInvoices.every(inv => inv.isSelected)}
                            indeterminate={
                              outstandingInvoices.some(inv => inv.isSelected) && 
                              !outstandingInvoices.every(inv => inv.isSelected)
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                selectAllInvoices();
                              } else {
                                clearAllSelections();
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>Invoice Number</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Total Amount</TableCell>
                        <TableCell align="right">Paid Amount</TableCell>
                        <TableCell align="right">Balance Amount</TableCell>
                        <TableCell align="right">Payment Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outstandingInvoices.map((invoice) => (
                        <TableRow 
                          key={invoice.id}
                          selected={invoice.isSelected}
                          sx={{ 
                            backgroundColor: invoice.isSelected ? 'action.selected' : 'inherit',
                            '&:hover': { backgroundColor: 'action.hover' }
                          }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={invoice.isSelected}
                              onChange={() => toggleInvoiceSelection(invoice.id)}
                            />
                          </TableCell>
                          <TableCell>{invoice.number}</TableCell>
                          <TableCell>{dayjs(invoice.date).format('DD-MM-YYYY')}</TableCell>
                          <TableCell align="right">₹{invoice.totalAmount.toFixed(2)}</TableCell>
                          <TableCell align="right">₹{invoice.paidAmount.toFixed(2)}</TableCell>
                          <TableCell align="right">
                            <Typography 
                              variant="body2" 
                              fontWeight={600} 
                              color={invoice.balanceAmount > 0 ? 'error.main' : 'success.main'}
                            >
                              ₹{invoice.balanceAmount.toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              value={invoice.paymentAmount}
                              onChange={(e) => updatePaymentAmount(invoice.id, Number(e.target.value))}
                              inputProps={{ 
                                min: 0, 
                                max: invoice.balanceAmount, 
                                step: '0.01' 
                              }}
                              size="small"
                              sx={{ width: '120px' }}
                              disabled={!invoice.isSelected}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </CardContent>
            </Card>
          )}

          {totals.selectedInvoices.length > 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Payment Summary
                    </Typography>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Total Invoices:</Typography>
                        <Typography variant="body2" fontWeight={600}>{totals.totalInvoices}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Total Amount:</Typography>
                        <Typography variant="body2" fontWeight={600}>₹{totals.totalPayment.toFixed(2)}</Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Posting Preview
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Ledger</TableCell>
                          <TableCell align="right">Debit</TableCell>
                          <TableCell align="right">Credit</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {postingPreview.map((entry, idx) => (
                          <TableRow key={`${entry.ledgerId}-${idx}`}>
                            <TableCell>
                              {entry.ledgerId === 'cash-ledger' ? 'Cash/Bank' : formState.partyName}
                            </TableCell>
                            <TableCell align="right">{(entry.debit || 0).toFixed(2)}</TableCell>
                            <TableCell align="right">{(entry.credit || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Typography
                      variant="caption"
                      color={postingBalanced ? 'success.main' : 'error.main'}
                      display="block"
                      mt={1}
                    >
                      {postingBalanced
                        ? 'Debits equal credits and voucher is balanced.'
                        : 'Debits do not equal credits yet.'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default PaymentVoucherForm;
