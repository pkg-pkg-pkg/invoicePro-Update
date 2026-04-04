import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Grid, IconButton, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, Checkbox, FormControlLabel } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import { inventoryItemService } from '../../../services/masters/inventoryItemService';
import { godownService } from '../../../services/masters/godownService';
import { partyService } from '../../../services/masters/partyService';
import { voucherService } from '../../../services/vouchers/voucherService';
import { InventoryItem, Godown } from '../../../types/masters';
import { Party } from '../../../types/party';
import { usePermission } from '../../../hooks/usePermission';
import { autoLedgerService } from '../../../services/masters/autoLedgerService';
import { generateId } from '../../../utils/id';
import QuickCreateSupplierDialog from '../../../components/QuickCreateSupplierDialog';
import QuickCreateLedgerDialog from '../../../components/QuickCreateLedgerDialog';
import { decideGSTType } from '../../../services/vouchers/gstDecisionEngine';
import { bifurcateTax } from '../../../services/vouchers/gstBifurcationEngine';
import { normalizeStateToCode } from '../../../utils/stateMapping';

interface ItemLineState {
  lineId: string;
  itemId: string;
  quantity: string;
  rate: string;
  gstPercent: string;
  godownId: string;
}

const isLineDataValid = (line: ItemLineState) =>
  Boolean(line.itemId && Number(line.quantity) > 0 && Number(line.rate) > 0 && line.godownId);

const computeLineAmount = (line: ItemLineState) => {
  const qty = Number(line.quantity) || 0;
  const rate = Number(line.rate) || 0;
  return Number((qty * rate).toFixed(2));
};

const computeLineTax = (line: ItemLineState) => {
  const base = computeLineAmount(line);
  const taxRate = Number(line.gstPercent) || 0;
  return Number((base * taxRate) / 100);
};

const PurchaseVoucherForm = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreate = can('create-vouchers');

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuickCreateSupplier, setShowQuickCreateSupplier] = useState(false);
  const [showQuickCreatePurchase, setShowQuickCreatePurchase] = useState(false);
  const [companyState, setCompanyState] = useState<string>('');
  const [supplierState, setSupplierState] = useState<string>('');
  const [enableRoundOff, setEnableRoundOff] = useState(true);

  const createLine = (godownId: string): ItemLineState => ({
    lineId: generateId('p-line'),
    itemId: '',
    quantity: '',
    rate: '',
    gstPercent: '0',
    godownId,
  });

  const [lines, setLines] = useState<ItemLineState[]>([createLine('')]);

  const [formState, setFormState] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    number: `PUR-${dayjs().format('YYYYMMDD-HHmmss')}`,
    partyId: '',
    supplierName: '', // Keep for backward compatibility
    supplierGstin: '',
    defaultGodownId: '',
    narration: '',
    purchaseLedgerId: '',
    termsAndConditions: '',
    notes: '',
  });

  useEffect(() => {
    // Load company state from localStorage
    const savedCompanyState = localStorage.getItem('companyState');
    if (savedCompanyState) {
      // Normalize company state to state code for proper comparison
      const normalized = normalizeStateToCode(savedCompanyState);
      setCompanyState(normalized);
    } else {
      // Try from company-info as fallback
      try {
        const companyInfoRaw = localStorage.getItem('company-info');
        if (companyInfoRaw) {
          const parsed = JSON.parse(companyInfoRaw);
          const rawState = parsed.state || '';
          const normalized = normalizeStateToCode(rawState);
          if (normalized) {
            setCompanyState(normalized);
          }
        }
      } catch {}
    }

    // Load parties for purchase (SUPPLIER + BOTH types)
    partyService
      .listForPurchase()
      .then(setParties)
      .catch(() => setParties([]));

    inventoryItemService
      .list({ includeInactive: false })
      .then((items) => setInventoryItems(items.filter((item) => item.status === 'ACTIVE')))
      .catch(() => setInventoryItems([]));
    godownService
      .list({ includeInactive: false })
      .then((list) => {
        const active = list.filter((godown) => godown.isActive !== false);
        setGodowns(active);
        setFormState((prev) => {
          if (prev.defaultGodownId || active.length === 0) return prev;
          return { ...prev, defaultGodownId: active[0].id };
        });
        setLines((prev) =>
          prev.map((line, idx) => {
            if (idx === 0 && !line.godownId && active.length) {
              return { ...line, godownId: active[0].id };
            }
            return line;
          })
        );
      })
      .catch(() => setGodowns([]));
  }, []);

  const updateLine = (index: number, patch: Partial<ItemLineState>) => {
    setLines((prev) =>
      prev.map((line, idx) => (idx === index ? { ...line, ...patch } : line))
    );
  };

  const addLine = () => setLines((prev) => [...prev, createLine(formState.defaultGodownId)]);

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const totals = useMemo(() => {
    // Calculate subtotal (pre-tax)
    const subtotal = lines.reduce((sum, line) => sum + computeLineAmount(line), 0);
    
    // Calculate total GST
    const taxTotal = lines.reduce((sum, line) => sum + computeLineTax(line), 0);
    
    // Grand total before round-off
    const totalBeforeRoundOff = subtotal + taxTotal;
    
    // Round-off (to nearest ₹1)
    const roundOff = enableRoundOff ? Math.round(totalBeforeRoundOff) - totalBeforeRoundOff : 0;
    
    // Final grand total
    const grandTotal = Number((totalBeforeRoundOff + roundOff).toFixed(2));

    // GST Decision using new engine
    // Get the selected party
    const selectedParty = parties.find(p => p.id === formState.partyId);
    
    let gstDecision;
    if (selectedParty) {
      gstDecision = decideGSTType(selectedParty, companyState);
    } else {
      // No party selected, create a minimal party object with supplier state
      const partyFromState: Party = {
        id: '',
        name: '',
        gstin: '',
        state: supplierState,
        mobile: '',
        email: '',
        address: '',
        pincode: '',
        partyType: 'SUPPLIER',
        ledgerId: '',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      gstDecision = decideGSTType(partyFromState, companyState);
    }
    
    // Calculate average GST rate from items
    const avgGstRate = lines.length > 0
      ? lines.reduce((sum, line) => sum + (Number(line.gstPercent) || 0), 0) / lines.length
      : 0;
    
    // Bifurcate tax
    const taxBifurcated = bifurcateTax(taxTotal, avgGstRate, gstDecision.taxType);

    return {
      subtotal: Number(subtotal.toFixed(2)),
      itemTax: Number(taxTotal.toFixed(2)),
      taxBifurcated,
      roundOff: Number(roundOff.toFixed(2)),
      grandTotal,
      supplyType: gstDecision.supplyType,
      taxType: gstDecision.taxType,
      gstDecision,
    };
  }, [lines, enableRoundOff, companyState, supplierState, formState.partyId, parties]);

  const canSubmit =
    canCreate &&
    formState.date &&
    formState.number &&
    formState.partyId.trim().length > 0 &&
    lines.some(isLineDataValid) &&
    !saving;

  const postingPreview = useMemo(() => {
    const entries: { ledgerId: string; ledgerName: string; debit: number; credit: number; description?: string }[] = [];
    
    // Only build preview if supplier is selected
    if (!formState.supplierName) {
      return entries;
    }
    
    // 1. Debit Purchase account with subtotal (pre-tax)
    if (totals.subtotal > 0) {
      entries.push({
        ledgerId: 'purchase',
        ledgerName: 'Purchase',
        debit: totals.subtotal,
        credit: 0,
        description: `Purchase (${lines.filter(l => l.itemId && Number(l.quantity) > 0).length} items)`,
      });
    }
    
    // 2. Credit GST Input (CGST/SGST or IGST - NEVER MIXED)
    if (totals.itemTax > 0) {
      if (totals.gstDecision.isLocalTransaction) {
        // INTRA-STATE: Show CGST and SGST separately
        if (totals.taxBifurcated.cgst > 0) {
          entries.push({
            ledgerId: 'cgst-input',
            ledgerName: 'CGST Input',
            debit: totals.taxBifurcated.cgst,
            credit: 0,
            description: `CGST on Purchase Items`,
          });
        }
        if (totals.taxBifurcated.sgst > 0) {
          entries.push({
            ledgerId: 'sgst-input',
            ledgerName: 'SGST Input',
            debit: totals.taxBifurcated.sgst,
            credit: 0,
            description: `SGST on Purchase Items`,
          });
        }
      } else {
        // INTER-STATE: Show IGST only
        if (totals.taxBifurcated.igst > 0) {
          entries.push({
            ledgerId: 'igst-input',
            ledgerName: 'IGST Input',
            debit: totals.taxBifurcated.igst,
            credit: 0,
            description: `IGST on Purchase Items`,
          });
        }
      }
    }
    
    // 3. Credit Supplier
    entries.push({
      ledgerId: 'supplier',
      ledgerName: formState.supplierName,
      debit: 0,
      credit: totals.grandTotal,
      description: 'Supplier (Purchase Invoice)',
    });
    
    // 4. Round-Off (if enabled and non-zero)
    if (enableRoundOff && totals.roundOff !== 0) {
      if (totals.roundOff > 0) {
        entries.push({
          ledgerId: 'round-off',
          ledgerName: 'Round Off',
          debit: totals.roundOff,
          credit: 0,
          description: `Round-off gain ₹${totals.roundOff.toFixed(2)}`,
        });
      } else {
        entries.push({
          ledgerId: 'round-off',
          ledgerName: 'Round Off',
          debit: 0,
          credit: Math.abs(totals.roundOff),
          description: `Round-off loss ₹${Math.abs(totals.roundOff).toFixed(2)}`,
        });
      }
    }
    
    return entries;
  }, [formState.partyId, totals, enableRoundOff, lines]);

  const postingBalanced = useMemo(() => {
    const totalDebit = postingPreview.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = postingPreview.reduce((sum, entry) => sum + entry.credit, 0);
    return totalDebit > 0 && Number(totalDebit.toFixed(2)) === Number(totalCredit.toFixed(2));
  }, [postingPreview]);

  const buildVoucherLines = async () => {
    const { purchaseLedgerId } = await autoLedgerService.ensureCore();
    
    // Get ledger ID from party
    const selectedParty = parties.find(p => p.id === formState.partyId);
    if (!selectedParty || !selectedParty.ledgerId) {
      throw new Error('Selected party does not have a valid ledger account');
    }
    const supplierLedgerId = selectedParty.ledgerId;
    
    const { cgstInputLedgerId, sgstInputLedgerId, igstInputLedgerId } = await autoLedgerService.ensureGSTInputLedgers();
    
    const voucherLines: any[] = [];
    
    // 1. Debit Purchase
    voucherLines.push({
      ledgerId: purchaseLedgerId,
      debit: totals.subtotal,
      credit: 0,
    });
    
    // 2. Debit GST Input (bifurcated)
    if (totals.itemTax > 0) {
      if (totals.gstDecision.isLocalTransaction) {
        if (totals.taxBifurcated.cgst > 0) {
          voucherLines.push({
            ledgerId: cgstInputLedgerId,
            debit: totals.taxBifurcated.cgst,
            credit: 0,
            taxType: 'CGST_SGST',
          });
        }
        if (totals.taxBifurcated.sgst > 0) {
          voucherLines.push({
            ledgerId: sgstInputLedgerId,
            debit: totals.taxBifurcated.sgst,
            credit: 0,
            taxType: 'CGST_SGST',
          });
        }
      } else {
        if (totals.taxBifurcated.igst > 0) {
          voucherLines.push({
            ledgerId: igstInputLedgerId,
            debit: totals.taxBifurcated.igst,
            credit: 0,
            taxType: 'IGST',
          });
        }
      }
    }
    
    // 3. Round-off (if applicable)
    if (enableRoundOff && totals.roundOff !== 0) {
      if (totals.roundOff > 0) {
        voucherLines.push({
          ledgerId: await autoLedgerService.ensureRoundOffLedger(),
          debit: totals.roundOff,
          credit: 0,
        });
      } else {
        voucherLines.push({
          ledgerId: await autoLedgerService.ensureRoundOffLedger(),
          debit: 0,
          credit: Math.abs(totals.roundOff),
        });
      }
    }
    
    // 4. Credit Supplier
    voucherLines.push({
      ledgerId: supplierLedgerId,
      debit: 0,
      credit: totals.grandTotal,
    });
    
    return voucherLines;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      setError('Please complete all required fields before saving.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const voucherLines = await buildVoucherLines();
      await voucherService.create({
        type: 'PURCHASE',
        date: new Date(formState.date).toISOString(),
        number: formState.number,
        narration: formState.narration,
        lines: voucherLines,
      });
      navigate('/vouchers/purchase');
    } catch (err) {
      setError((err as Error).message ?? 'Failed to create voucher');
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
                New Purchase Voucher
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Record purchases with automatic GST bifurcation ({totals.gstDecision.isLocalTransaction ? 'CGST + SGST' : 'IGST'}).
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained" disabled={!canSubmit}>
                {saving ? 'Saving...' : 'Save Voucher'}
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
                        label="Voucher Date"
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
                    <Grid item xs={12} md={3}>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          select
                          label="Supplier"
                          value={formState.partyId}
                          onChange={(e) => {
                            const selectedParty = parties.find(p => p.id === e.target.value);
                            setFormState((prev) => ({
                              ...prev,
                              partyId: e.target.value,
                              supplierName: selectedParty?.name || '',
                              supplierGstin: selectedParty?.gstin || '',
                            }));
                            if (selectedParty) {
                              // Resolve supplier state: GSTIN first, then state field, else empty
                              if (selectedParty.gstin && selectedParty.gstin.length >= 2) {
                                // Extract state code from GSTIN (first 2 digits)
                                const stateCode = selectedParty.gstin.substring(0, 2);
                                setSupplierState(stateCode);
                              } else if (selectedParty.state) {
                                // Fall back to state field (could be name or code, will be normalized)
                                setSupplierState(selectedParty.state);
                              } else {
                                // No state info available
                                setSupplierState('');
                              }
                            }
                          }}
                          fullWidth
                          required
                        >
                          <MenuItem value="">
                            <em>Select Supplier</em>
                          </MenuItem>
                          {parties.map((party) => (
                            <MenuItem key={party.id} value={party.id}>
                              {party.name} ({party.mobile})
                            </MenuItem>
                          ))}
                        </TextField>
                        <Button
                          variant="outlined"
                          onClick={() => setShowQuickCreateSupplier(true)}
                          sx={{ minWidth: '100px' }}
                        >
                          + New
                        </Button>
                      </Stack>
                    </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                label="Supplier State Code"
                value={normalizeStateToCode(supplierState)}
                onChange={(e) => {
                  // Only allow manual edit if no supplier is selected
                  if (!formState.partyId) {
                    setSupplierState(e.target.value);
                  }
                }}
                fullWidth
                disabled={Boolean(formState.partyId)}
                helperText={formState.partyId ? "Auto-determined from GSTIN/Profile" : "Auto-detected when supplier is selected"}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Select
                  displayEmpty
                  value={formState.defaultGodownId}
                  onChange={(e) => setFormState((prev) => ({ ...prev, defaultGodownId: e.target.value }))}
                  fullWidth
                >
                  <MenuItem value="">
                    <em>Select Godown</em>
                  </MenuItem>
                  {godowns.map((godown) => (
                    <MenuItem key={godown.id} value={godown.id}>
                      {godown.name}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>
            </Grid>
            {formState.partyId && (
              <>
                <Grid item xs={12}>
                  <Typography variant="body2">
                    <strong>Company State Code:</strong> {companyState || 'Not set'} {companyState ? `✓` : ''}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2">
                    <strong>Supplier State Code:</strong> {normalizeStateToCode(supplierState) || 'Not determined'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2">
                    <strong>GST Type:</strong>{' '}
                    <span style={{ color: totals.gstDecision.isLocalTransaction ? 'green' : 'orange', fontWeight: 600 }}>
                      {totals.gstDecision.isLocalTransaction ? '✓ CGST + SGST (Intra-State)' : '✓ IGST (Inter-State)'}
                    </span>
                  </Typography>
                </Grid>
              </>
            )}
          </Grid>

          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight={600}>
                Inventory Items
              </Typography>
              <Button variant="text" startIcon={<AddIcon />} onClick={addLine}>
                Add Item
              </Button>
            </Stack>
            <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ '& td': { verticalAlignment: 'top' }, minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 200 }}>Item</TableCell>
                  <TableCell sx={{ minWidth: 100, width: 100 }} align="right">Qty</TableCell>
                  <TableCell sx={{ minWidth: 120, width: 120 }} align="right">Rate</TableCell>
                  <TableCell sx={{ minWidth: 80, width: 80 }} align="right">GST %</TableCell>
                  <TableCell sx={{ minWidth: 120, width: 120 }} align="right">Amount</TableCell>
                  <TableCell sx={{ minWidth: 180, width: 180 }}>Godown</TableCell>
                  <TableCell sx={{ minWidth: 80, width: 80 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={`line-${line.lineId}`}>
                    <TableCell sx={{ minWidth: 200 }}>
                      <Select
                        displayEmpty
                        value={line.itemId}
                        onChange={(e) => updateLine(index, { itemId: e.target.value })}
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="">
                          <em>Select Item</em>
                        </MenuItem>
                        {inventoryItems.map((item) => (
                          <MenuItem key={item.id} value={item.id}>
                            {item.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell sx={{ minWidth: 100, width: 100 }} align="right">
                      <TextField
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: e.target.value })}
                        inputProps={{ min: 0, step: '0.01' }}
                        size="small"
                        fullWidth
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120, width: 120 }} align="right">
                      <TextField
                        type="number"
                        value={line.rate}
                        onChange={(e) => updateLine(index, { rate: e.target.value })}
                        inputProps={{ min: 0, step: '0.01' }}
                        size="small"
                        fullWidth
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 80, width: 80 }} align="right">
                      <TextField
                        type="number"
                        value={line.gstPercent}
                        onChange={(e) => updateLine(index, { gstPercent: e.target.value })}
                        inputProps={{ min: 0, max: 28, step: '0.01' }}
                        size="small"
                        fullWidth
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120, width: 120 }} align="right">
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {computeLineAmount(line).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 180, width: 180 }}>
                      <Select
                        displayEmpty
                        value={line.godownId}
                        onChange={(e) => updateLine(index, { godownId: e.target.value })}
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="">
                          <em>Select</em>
                        </MenuItem>
                        {godowns.map((godown) => (
                          <MenuItem key={godown.id} value={godown.id}>
                            {godown.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell sx={{ minWidth: 80, width: 80 }} align="right">
                      <IconButton onClick={() => removeLine(index)} disabled={lines.length === 1}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </Box>
          </Stack>

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
                    Totals & Tax Bifurcation ({totals.gstDecision.isLocalTransaction ? 'CGST + SGST' : 'IGST'})
                  </Typography>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Subtotal:</Typography>
                      <Typography variant="body2" fontWeight={600}>₹ {totals.subtotal.toFixed(2)}</Typography>
                    </Stack>
                    {totals.gstDecision.isLocalTransaction ? (
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
                    {enableRoundOff && totals.roundOff !== 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Round-Off:</Typography>
                        <Typography variant="body2" fontWeight={600} color={totals.roundOff > 0 ? 'success.main' : 'error.main'}>
                          ₹ {totals.roundOff.toFixed(2)}
                        </Typography>
                      </Stack>
                    )}
                    <Stack direction="row" justifyContent="space-between" sx={{ pt: 1, borderTop: '1px solid #ddd' }}>
                      <Typography variant="subtitle2" fontWeight={700}>Grand Total:</Typography>
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

        {/* Terms and Conditions */}
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={600}>
                Terms & Conditions
              </Typography>
              <TextField
                label="Terms and Conditions"
                multiline
                rows={3}
                value={formState.termsAndConditions}
                onChange={(e) => setFormState(prev => ({ ...prev, termsAndConditions: e.target.value }))}
                fullWidth
                placeholder="Enter payment terms, delivery conditions, warranty information, etc."
              />
              <TextField
                label="Additional Notes"
                multiline
                rows={2}
                value={formState.notes}
                onChange={(e) => setFormState(prev => ({ ...prev, notes: e.target.value }))}
                fullWidth
                placeholder="Enter any additional notes or remarks"
              />
            </Stack>
          </CardContent>
        </Card>

        <QuickCreateSupplierDialog
          open={showQuickCreateSupplier}
          onClose={() => setShowQuickCreateSupplier(false)}
          onSave={(supplierName) => {
            setFormState((prev) => ({ ...prev, supplierName }));
          }}
        />

        <QuickCreateLedgerDialog
          open={showQuickCreatePurchase}
          onClose={() => setShowQuickCreatePurchase(false)}
          ledgerType="PURCHASE"
          title="Create New Purchase Account"
          onSave={(ledgerId) => {
            setFormState((prev) => ({ ...prev, purchaseLedgerId: ledgerId }));
          }}
        />
      </Stack>
    </CardContent>
  </Card>
  );
};

export default PurchaseVoucherForm;

