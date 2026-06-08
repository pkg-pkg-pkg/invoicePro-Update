import { useState, useEffect, useMemo } from 'react';
import { Alert, Box, Button, Card, CardContent, Grid, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, Checkbox, FormControlLabel } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import { voucherService } from '../../../services/vouchers/voucherService';
import { usePermission } from '../../../hooks/usePermission';
import { autoLedgerService } from '../../../services/masters/autoLedgerService';
import { fetchOriginalInvoice, calculateReturnTotals, validateReturnQuantities, OriginalInvoiceData, InvoiceItem } from '../../../services/returns/returnService';
import { decideGSTType } from '../../../services/vouchers/gstDecisionEngine';
import { bifurcateTax } from '../../../services/vouchers/gstBifurcationEngine';
import schemeService, { Scheme } from '../../../services/schemeService';
import { getBestScheme } from '../../../services/schemeResolutionEngine';

import { VoucherTotals } from '../../../types/VoucherTotals';
import { getNormalizedCompanyProfile } from '../../../utils/companyProfile';

const SalesReturnVoucherForm = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreate = can('create-vouchers');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [originalInvoice, setOriginalInvoice] = useState<OriginalInvoiceData | null>(null);
  const [companyState, setCompanyState] = useState<string>('');

  const [formState, setFormState] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    number: `SR-${dayjs().format('YYYYMMDD-HHmmss')}`,
    invoiceNumber: '',
    narration: '',
  });

  const [returnItems, setReturnItems] = useState<InvoiceItem[]>([]);
  const [enableRoundOff, setEnableRoundOff] = useState(true);
  const [activeSalesSchemes, setActiveSalesSchemes] = useState<Scheme[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadSchemes = async () => {
      try {
        const auth = JSON.parse(localStorage.getItem('gst_billing_auth') || '{}');
        const companyId = auth?.user?.companyId || auth?.company?.id;
        if (!companyId) return;
        const schemes = await schemeService.getSchemes(companyId);
        if (!mounted) return;
        setActiveSalesSchemes(schemes.filter((s) => s.appliesTo === 'SALES' || s.appliesTo === 'BOTH'));
      } catch {
        if (!mounted) return;
        setActiveSalesSchemes([]);
      }
    };
    loadSchemes();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const rawState = getNormalizedCompanyProfile().state || '';
    if (rawState) setCompanyState(rawState);
  }, []);

  const handleInvoiceSearch = async () => {
    if (!formState.invoiceNumber.trim()) {
      setError('Please enter an invoice number');
      return;
    }

    setLoadingInvoice(true);
    setError(null);

    try {
      const invoiceData = await fetchOriginalInvoice(formState.invoiceNumber.trim());
      
      if (!invoiceData) {
        setError('Invoice not found. Please check the invoice number and try again.');
        return;
      }

      if (invoiceData.type !== 'SALES') {
        setError('This is not a sales invoice. Please select a sales invoice for returns.');
        return;
      }

      setOriginalInvoice(invoiceData);
      
      // Initialize return items with zero quantities
      const initializedItems = invoiceData.items.map(item => ({
        ...item,
        returnedQuantity: 0,
      }));
      
      setReturnItems(initializedItems);
      
      // Auto-populate narration
      setFormState(prev => ({
        ...prev,
        narration: `Return against invoice ${invoiceData.number} - ${invoiceData.partyName}`,
      }));

    } catch (err) {
      setError('Failed to load invoice data. Please try again.');
      console.error('Invoice fetch error:', err);
    } finally {
      setLoadingInvoice(false);
    }
  };

  const updateReturnQuantity = (index: number, quantity: number) => {
    setReturnItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        returnedQuantity: Math.max(0, Math.min(quantity, updated[index].maxReturnableQuantity)),
      };
      return updated;
    });
  };

  const totals = useMemo((): VoucherTotals => {
    if (!originalInvoice || returnItems.length === 0) {
      return { subtotal: 0, tax: 0, grandTotal: 0, taxBifurcated: { cgst: 0, sgst: 0, igst: 0, total: 0, type: 'CGST_SGST' as const } };
    }

    const calculated = calculateReturnTotals(returnItems);
    
    // GST Decision (use original invoice party info)
    const partyFromInvoice = {
      id: originalInvoice.partyLedgerId,
      name: originalInvoice.partyName,
      gstin: '', // Would need to be fetched from original invoice
      state: '', // Would need to be fetched from original invoice
      mobile: '',
      email: '',
      address: '',
      pincode: '',
      partyType: 'BUYER' as const,
      ledgerId: originalInvoice.partyLedgerId,
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const gstDecision = decideGSTType(partyFromInvoice, companyState);
    const taxBifurcated = bifurcateTax(calculated.tax, 18, gstDecision.taxType); // Use average tax rate

    // Round-off
    const roundOff = enableRoundOff ? Math.round(calculated.grandTotal) - calculated.grandTotal : 0;
    const finalGrandTotal = calculated.grandTotal + roundOff;

    return {
      ...calculated,
      grandTotal: finalGrandTotal,
      roundOff,
      taxBifurcated,
      gstDecision,
    };
  }, [originalInvoice, returnItems, companyState, enableRoundOff]);

  const postingPreview = useMemo(() => {
    if (!originalInvoice || returnItems.length === 0) return [];

    const entries: { ledgerId: string; ledgerName: string; debit: number; credit: number; description?: string }[] = [];
    
    // 1. Credit Sales (reverse of original sale)
    entries.push({
      ledgerId: 'sales-ledger',
      ledgerName: 'Sales Returns',
      debit: 0,
      credit: totals.subtotal,
      description: `Sales Return against ${originalInvoice.number}`,
    });

    // 2. Credit GST (reverse of original tax)
    if (totals.tax > 0) {
      if (totals.gstDecision?.isLocalTransaction) {
        if (totals.taxBifurcated.cgst > 0) {
          entries.push({
            ledgerId: 'cgst-output',
            ledgerName: 'CGST Output',
            debit: 0,
            credit: totals.taxBifurcated.cgst,
            description: `CGST on Sales Return`,
          });
        }
        if (totals.taxBifurcated.sgst > 0) {
          entries.push({
            ledgerId: 'sgst-output', 
            ledgerName: 'SGST Output',
            debit: 0,
            credit: totals.taxBifurcated.sgst,
            description: `SGST on Sales Return`,
          });
        }
      } else {
        if (totals.taxBifurcated.igst > 0) {
          entries.push({
            ledgerId: 'igst-output',
            ledgerName: 'IGST Output', 
            debit: 0,
            credit: totals.taxBifurcated.igst,
            description: `IGST on Sales Return`,
          });
        }
      }
    }

    // 3. Debit Customer (reverse of original receipt)
    entries.push({
      ledgerId: originalInvoice.partyLedgerId,
      ledgerName: originalInvoice.partyName,
      debit: totals.grandTotal,
      credit: 0,
      description: `Customer Refund for ${originalInvoice.number}`,
    });

    // 4. Round-off adjustment
    if (enableRoundOff && (totals.roundOff ?? 0) !== 0) {
      entries.push({
        ledgerId: 'round-off',
        ledgerName: 'Round Off',
        debit: (totals.roundOff ?? 0) > 0 ? totals.roundOff! : 0,
        credit: (totals.roundOff ?? 0) < 0 ? Math.abs(totals.roundOff!) : 0,
        description: `Round-off adjustment`,
      });
    }

    return entries;
  }, [originalInvoice, totals]);

  const postingBalanced = useMemo(() => {
    const totalDebit = postingPreview.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = postingPreview.reduce((sum, entry) => sum + entry.credit, 0);
    return totalDebit > 0 && Number(totalDebit.toFixed(2)) === Number(totalCredit.toFixed(2));
  }, [postingPreview]);

  const canSubmit =
    canCreate &&
    formState.date &&
    formState.number &&
    originalInvoice &&
    returnItems.some(item => item.returnedQuantity && item.returnedQuantity > 0) &&
    postingBalanced &&
    !saving;

  const buildVoucherLines = async () => {
    if (!originalInvoice) throw new Error('Original invoice data is required');

    const { salesReturnLedgerId } = await autoLedgerService.ensureCore();
    const { cgstOutputLedgerId, sgstOutputLedgerId, igstOutputLedgerId } = await autoLedgerService.ensureGSTOutputLedgers();
    const roundOffLedgerId = await autoLedgerService.ensureRoundOffLedger();

    const lines: any[] = [];

    // 1. Credit Sales Returns
    lines.push({
      ledgerId: salesReturnLedgerId,
      debit: 0,
      credit: totals.subtotal,
    });

    // 2. Credit GST (reverse tax)
    if (totals.tax > 0) {
      if (totals.gstDecision?.isLocalTransaction) {
        if (totals.taxBifurcated.cgst > 0) {
          lines.push({
            ledgerId: cgstOutputLedgerId,
            debit: 0,
            credit: totals.taxBifurcated.cgst,
          });
        }
        if (totals.taxBifurcated.sgst > 0) {
          lines.push({
            ledgerId: sgstOutputLedgerId,
            debit: 0,
            credit: totals.taxBifurcated.sgst,
          });
        }
      } else {
        if (totals.taxBifurcated.igst > 0) {
          lines.push({
            ledgerId: igstOutputLedgerId,
            debit: 0,
            credit: totals.taxBifurcated.igst,
          });
        }
      }
    }

    // 3. Debit Customer
    lines.push({
      ledgerId: originalInvoice.partyLedgerId,
      debit: totals.grandTotal,
      credit: 0,
    });

    // 4. Round-off
    if (enableRoundOff && (totals.roundOff ?? 0) !== 0) {
      lines.push({
        ledgerId: roundOffLedgerId,
        debit: (totals.roundOff ?? 0) > 0 ? totals.roundOff! : 0,
        credit: (totals.roundOff ?? 0) < 0 ? Math.abs(totals.roundOff!) : 0,
      });
    }

    return lines;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!canSubmit) {
      setError('Please complete all required fields before saving.');
      return;
    }

    const validation = validateReturnQuantities(returnItems);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const voucherLines = await buildVoucherLines();
      
      await voucherService.create({
        type: 'SALES_RETURN',
        date: new Date(formState.date).toISOString(),
        number: formState.number,
        narration: formState.narration,
        lines: voucherLines,
      });

      if (originalInvoice?.partyLedgerId && activeSalesSchemes.length > 0) {
        const txnDate = new Date(formState.date);
        const perSchemeNegativeImpact = new Map<string, number>();
        returnItems.forEach((item) => {
          const returnQty = Number(item.returnedQuantity || 0);
          if (!item.productId || returnQty <= 0) return;
          const best = getBestScheme(item.productId, returnQty, 'SALES', activeSalesSchemes, txnDate);
          if (!best) return;
          const amount = Number((returnQty * Number(item.rate || 0)).toFixed(2));
          if (amount <= 0) return;
          perSchemeNegativeImpact.set(
            best.scheme.id,
            Number(((perSchemeNegativeImpact.get(best.scheme.id) || 0) + amount).toFixed(2))
          );
        });
        if (perSchemeNegativeImpact.size > 0) {
          await Promise.allSettled(
            Array.from(perSchemeNegativeImpact.entries()).map(([schemeId, amount]) =>
              schemeService.updateSchemeProgress({
                schemeId,
                retailerId: originalInvoice.partyLedgerId,
                invoiceAmount: -amount,
                paymentReceived: 0,
                paymentPending: -amount,
              })
            )
          );
        }
      }
      
      navigate('/vouchers/sales-return');
    } catch (err) {
      setError((err as Error).message ?? 'Failed to create sales return voucher');
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
                New Sales Return Voucher
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Process returns against original sales invoices with proper GST reversal
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} flexWrap="wrap" justifyContent="flex-end" sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <Button type="submit" variant="contained" disabled={!canSubmit}>
                {saving ? 'Saving...' : 'Save Return'}
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
                label="Return Date"
                type="date"
                value={formState.date}
                onChange={(e) => setFormState((prev) => ({ ...prev, date: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                label="Return Number"
                value={formState.number}
                onChange={(e) => setFormState((prev) => ({ ...prev, number: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Invoice Number"
                  value={formState.invoiceNumber}
                  onChange={(e) => setFormState((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                  fullWidth
                  placeholder="Enter invoice number to search"
                />
                <Button
                  variant="outlined"
                  onClick={handleInvoiceSearch}
                  disabled={loadingInvoice}
                  startIcon={<SearchIcon />}
                  sx={{ minWidth: '120px' }}
                >
                  {loadingInvoice ? 'Searching...' : 'Search'}
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

          {originalInvoice && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              <Typography variant="body2">
                <strong>Original Invoice:</strong> {originalInvoice.number} | 
                <strong> Date:</strong> {dayjs(originalInvoice.date).format('DD-MM-YYYY')} | 
                <strong> Customer:</strong> {originalInvoice.partyName} | 
                <strong> Total:</strong> ₹{originalInvoice.totalAmount.toFixed(2)}
              </Typography>
            </Alert>
          )}

          {originalInvoice && returnItems.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Return Items
                </Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 800 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell align="right">Original Qty</TableCell>
                        <TableCell align="right">Rate</TableCell>
                        <TableCell align="right">Return Qty</TableCell>
                        <TableCell align="right">Return Amount</TableCell>
                        <TableCell align="right">Tax %</TableCell>
                        <TableCell align="right">Tax Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {returnItems.map((item, index) => {
                        const returnQty = item.returnedQuantity || 0;
                        const returnAmount = returnQty * item.rate;
                        const taxAmount = returnAmount * (item.taxRate / 100);
                        const totalAmount = returnAmount + taxAmount;

                        return (
                          <TableRow key={item.id}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell align="right">{item.quantity}</TableCell>
                            <TableCell align="right">₹{item.rate.toFixed(2)}</TableCell>
                            <TableCell align="right">
                              <TextField
                                type="number"
                                value={returnQty}
                                onChange={(e) => updateReturnQuantity(index, Number(e.target.value))}
                                inputProps={{ 
                                  min: 0, 
                                  max: item.maxReturnableQuantity, 
                                  step: '0.01' 
                                }}
                                size="small"
                                sx={{ width: '100px' }}
                              />
                            </TableCell>
                            <TableCell align="right">₹{returnAmount.toFixed(2)}</TableCell>
                            <TableCell align="right">{item.taxRate}%</TableCell>
                            <TableCell align="right">₹{taxAmount.toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              </CardContent>
            </Card>
          )}

          {originalInvoice && (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={enableRoundOff}
                    onChange={(e) => setEnableRoundOff(e.target.checked)}
                  />
                }
                label="Enable Automatic Round-Off (to nearest ₹1)"
              />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        Return Totals ({totals.gstDecision?.isLocalTransaction ? 'CGST + SGST' : 'IGST'})
                      </Typography>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Subtotal:</Typography>
                          <Typography variant="body2" fontWeight={600}>₹ {totals.subtotal.toFixed(2)}</Typography>
                        </Stack>
                        {totals.gstDecision?.isLocalTransaction ? (
                          <>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="body2">CGST:</Typography>
                              <Typography variant="body2" fontWeight={600}>₹ {totals.taxBifurcated.cgst.toFixed(2)}</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="body2">SGST:</Typography>
                              <Typography variant="body2" fontWeight={600}>₹ {totals.taxBifurcated.sgst.toFixed(2)}</Typography>
                            </Stack>
                          </>
                        ) : (
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">IGST:</Typography>
                            <Typography variant="body2" fontWeight={600}>₹ {totals.taxBifurcated.igst.toFixed(2)}</Typography>
                          </Stack>
                        )}
                        {(totals.roundOff ?? 0) !== 0 && (
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Round-Off:</Typography>
                            <Typography variant="body2" fontWeight={600} color={(totals.roundOff ?? 0) > 0 ? 'success.main' : 'error.main'}>
                              ₹ {(totals.roundOff ?? 0).toFixed(2)}
                            </Typography>
                          </Stack>
                        )}
                        <Stack direction="row" justifyContent="space-between" sx={{ pt: 1, borderTop: '1px solid #ddd' }}>
                          <Typography variant="subtitle2" fontWeight={700}>Total Return:</Typography>
                          <Typography variant="subtitle2" fontWeight={700}>₹ {totals.grandTotal.toFixed(2)}</Typography>
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
                              <TableCell>{entry.ledgerName}</TableCell>
                              <TableCell align="right">{entry.debit.toFixed(2)}</TableCell>
                              <TableCell align="right">{entry.credit.toFixed(2)}</TableCell>
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
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default SalesReturnVoucherForm;
