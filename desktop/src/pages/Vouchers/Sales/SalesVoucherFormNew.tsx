import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Grid, Stack, Typography, TextField, Autocomplete } from '@mui/material';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import InvoiceHeader from './components/InvoiceHeader';
import ActionFooter from './components/ActionFooter';
import ItemDetailDrawer, { ItemDetailFormValues } from './components/ItemDetailDrawer';
import PostSaveActionsDialog from '../../../components/PostSaveActionsDialog';
import QuickCreateCustomerDialog from '../../../components/QuickCreateCustomerDialog';
import { inventoryItemService } from '../../../services/masters/inventoryItemService';
import { godownService } from '../../../services/masters/godownService';
import { partyService } from '../../../services/masters/partyService';
import { voucherService } from '../../../services/vouchers/voucherService';
import { InventoryItem, Godown } from '../../../types/masters';
import { Party } from '../../../types/party';
import { usePermission } from '../../../hooks/usePermission';
import { focusRegistry } from '../../../services/focus/focusRegistry';
import { generateId } from '../../../utils/id';
import { autoLedgerService } from '../../../services/masters/autoLedgerService';
import { determineTaxType, bifurcateTax } from '../../../services/vouchers/gstBifurcationEngine';
import { normalizeStateToCode, statesMatch } from '../../../utils/stateMapping';
import { getNormalizedCompanyProfile } from '../../../utils/companyProfile';

type ItemLineState = ItemDetailFormValues;

const toNumber = (value: string | number | undefined, precision = 2) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(precision));
};

const computeLineAmount = (line: ItemLineState) => {
  const qty = toNumber(line.quantity);
  const rate = toNumber(line.rateExclusive);
  return toNumber(qty * rate);
};

const computeLineTax = (line: ItemLineState) => {
  const base = computeLineAmount(line);
  const taxRate = toNumber(line.taxRate);
  return toNumber((base * taxRate) / 100);
};

const isLineDataValid = (line: ItemLineState) =>
  Boolean(line.itemId && toNumber(line.quantity) > 0 && toNumber(line.rateExclusive) > 0);

const SalesVoucherFormNew = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreate = can('create-vouchers');

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [parties, setParties] = useState<Party[]>([]);

  const createLine = (godownId: string): ItemLineState => ({
    lineId: generateId('s-line'),
    itemId: '',
    quantity: '',
    rateExclusive: '',
    rateInclusive: '',
    taxRate: '',
    godownId,
  });

  const [lines, setLines] = useState<ItemLineState[]>([createLine('')]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'view'>('edit');
  const [showPostSaveDialog, setShowPostSaveDialog] = useState(false);
  const [showQuickCreateCustomer, setShowQuickCreateCustomer] = useState(false);
  const [customerState, setCustomerState] = useState<string>('');
  const company = useMemo(() => {
    const normalized = getNormalizedCompanyProfile();
    return {
      name: normalized.name || normalized.businessName,
      address: normalized.address,
      gstin: normalized.gstin,
      phone: normalized.phone,
      email: normalized.email,
      state: normalized.state,
    };
  }, []);

  const [formState, setFormState] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    number: `SAL-${dayjs().format('YYYYMMDD-HHmmss')}`,
    customerName: '',
    defaultGodownId: '',
    narration: '',
    discountPercent: '0',
    discountAmount: '0',
    freightAmount: '0',
  });



  useEffect(() => {
    inventoryItemService
      .list({ includeInactive: false })
      .then((items) => setInventoryItems(items.filter((item) => item.status === 'ACTIVE')))
      .catch(() => setInventoryItems([]));

    godownService
      .list({ includeInactive: false })
      .then((list) => {
        const active = list.filter((godown) => godown.isActive !== false);
        const preferred = active.find((godown) => godown.isDefault) ?? active[0] ?? null;
        setGodowns(active);
        setFormState((prev) => {
          if (!preferred) return prev;
          if (prev.defaultGodownId === preferred.id) return prev;
          return { ...prev, defaultGodownId: preferred.id };
        });
        setLines((prev) =>
          prev.map((line) => {
            if (!line.godownId && preferred) {
              return { ...line, godownId: preferred.id };
            }
            return line;
          })
        );
      })
      .catch(() => setGodowns([]));

    // Load parties (customers) for dropdown
    partyService
      .list()
      .then((data) => setParties(data || []))
      .catch(() => setParties([]));
  }, []);

  useEffect(() => {
    if (!formState.defaultGodownId) return;
    setLines((prev) =>
      prev.map((line) => (line.godownId ? line : { ...line, godownId: formState.defaultGodownId }))
    );
  }, [formState.defaultGodownId]);

  // When customer name changes, resolve the customer state from party master
  useEffect(() => {
    if (formState.customerName && parties.length > 0) {
      const party = parties.find(p => p.name === formState.customerName);
      if (party) {
        // Priority 1: Try to get state from GSTIN (first 2 digits = state code)
        if (party.gstin && party.gstin.length >= 2) {
          const stateCode = party.gstin.substring(0, 2);
          setCustomerState(stateCode);
        } else if (party.state) {
          // Priority 2: Use party's state field (could be name or code)
          setCustomerState(party.state);
        } else {
          // Priority 3: Empty if no state info
          setCustomerState('');
        }
      } else {
        setCustomerState('');
      }
    } else {
      setCustomerState('');
    }
  }, [formState.customerName, parties]);

  const itemMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventoryItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [inventoryItems]);

  const getItemName = useCallback((itemId: string) => itemMap.get(itemId)?.name ?? itemId, [itemMap]);

  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [drawerValues, setDrawerValues] = useState<ItemDetailFormValues | null>(null);
  const [showDrawerValidation, setShowDrawerValidation] = useState(false);

  // Get company state from localStorage
  const companyState = useMemo(() => {
    try {
      const companyInfoRaw = localStorage.getItem('company-info');
      if (companyInfoRaw) {
        const parsed = JSON.parse(companyInfoRaw);
        // Normalize company state to state code for proper comparison
        const rawState = parsed.state || '';
        return normalizeStateToCode(rawState);
      }
    } catch {}
    return '';
  }, []);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + computeLineAmount(line), 0);
    const taxTotal = lines.reduce((sum, line) => sum + computeLineTax(line), 0);
    
    // Normalize states to codes for proper comparison
    const normalizedCompanyState = companyState || normalizeStateToCode(companyState);
    const normalizedCustomerState = normalizeStateToCode(customerState);
    
    // Determine GST type based on company and customer state
    // Both states should be normalized to codes (2-digit format) for comparison
    const isLocalTransaction = normalizedCompanyState === normalizedCustomerState;
    const taxType = isLocalTransaction ? 'CGST_SGST' : 'IGST';
    
    // Calculate average GST rate from items
    const avgGstRate = lines.length > 0
      ? lines.reduce((sum, line) => sum + (Number(line.taxRate) || 0), 0) / lines.length
      : 0;
    
    // Bifurcate tax (either CGST+SGST or IGST)
    const taxBifurcated = bifurcateTax(taxTotal, avgGstRate, taxType);
    
    const finalGrandTotal = Number((subtotal + taxTotal).toFixed(2));
    
    return {
      subtotal,
      tax: taxTotal,
      grandTotal: finalGrandTotal,
      taxBifurcated,
      taxType,
      gstDecision: {
        isLocalTransaction,
        taxType,
      },
    };
  }, [lines, companyState, customerState]);

  // Derived totals for printing (proper CGST/SGST or IGST split based on supply type)
  const summaryTotals = useMemo(() => {
    return {
      subtotal: totals.subtotal,
      cgst: totals.taxBifurcated.cgst,
      sgst: totals.taxBifurcated.sgst,
      igst: totals.taxBifurcated.igst,
      grandTotal: totals.grandTotal,
      amountInWords: '',
    };
  }, [totals]);

  const summaryLines = useMemo(
    () =>
      lines.map((line) => {
        // Calculate line-level tax bifurcation
        const lineAmount = computeLineAmount(line);
        const lineTax = computeLineTax(line);
        const lineTaxBifurcated = bifurcateTax(lineTax, toNumber(line.taxRate), totals.taxType as 'CGST_SGST' | 'IGST');
        
        return {
          lineId: line.lineId,
          itemName: getItemName(line.itemId) || 'Select Item',
          quantity: toNumber(line.quantity),
          rate: toNumber(line.rateExclusive),
          amount: lineAmount,
          taxRate: toNumber(line.taxRate),
          godownName: godowns.find((g) => g.id === line.godownId)?.name ?? 'Not set',
          hsn: String((line as any).hsnCode || ''),
          cgst: lineTaxBifurcated.cgst,
          sgst: lineTaxBifurcated.sgst,
          igst: lineTaxBifurcated.igst,
        };
      }),
    [lines, getItemName, godowns, totals.taxType]
  );

  const buildDrawerLine = useCallback(
    (line?: ItemLineState): ItemDetailFormValues => ({
      lineId: line?.lineId ?? generateId('s-line'),
      itemId: line?.itemId ?? '',
      quantity: line?.quantity ?? '',
      rateExclusive: line?.rateExclusive ?? '',
      rateInclusive: line?.rateInclusive ?? '',
      taxRate: line?.taxRate ?? '',
      godownId: line?.godownId ?? formState.defaultGodownId ?? '',
      hsnCode: line?.hsnCode ?? '',
      discountAmount: line?.discountAmount ?? '',
      discountPercent: line?.discountPercent ?? '',
      batchNumber: line?.batchNumber ?? '',
    }),
    [formState.defaultGodownId]
  );

  const openDrawerForLine = useCallback(
    (index: number | null) => {
      if (index === null) {
        setActiveLineIndex(null);
        setDrawerValues(buildDrawerLine());
        focusRegistry.queueFocus('drawer-item');
        return;
      }
      const existing = lines[index];
      setActiveLineIndex(index);
      setDrawerValues(buildDrawerLine(existing));
    },
    [buildDrawerLine, lines]
  );

  const closeDrawer = () => {
    setActiveLineIndex(null);
    setDrawerValues(null);
    setShowDrawerValidation(false);
  };

  const handleDrawerSave = () => {
    if (!drawerValues) return;
    if (!isLineDataValid(drawerValues)) {
      setShowDrawerValidation(true);
      return;
    }
    setShowDrawerValidation(false);
    if (activeLineIndex === null) {
      setLines((prev) => [...prev, drawerValues]);
    } else {
      setLines((prev) => prev.map((line, idx) => (idx === activeLineIndex ? drawerValues : line)));
    }
    closeDrawer();
  };

  const canSubmit = canCreate && lines.every(isLineDataValid) && formState.customerName.trim().length > 0 && !saving;

  const buildVoucherLines = async () => {
    const { salesLedgerId, gstLedgerId } = await autoLedgerService.ensureCore();
    const customerLedgerId = await autoLedgerService.ensureCustomerLedger(formState.customerName);

    const salesLines = lines
      .filter((line) => line.itemId && Number(line.quantity) > 0)
      .map((line) => ({
        ledgerId: salesLedgerId,
        debit: 0,
        credit: computeLineAmount(line),
        itemId: line.itemId,
        quantity: Number(line.quantity),
        godownId: line.godownId,
      }));

    const taxLines = totals.tax > 0 ? [{ ledgerId: gstLedgerId, debit: 0, credit: totals.tax }] : [];

    const customerLine = {
      ledgerId: customerLedgerId,
      debit: totals.grandTotal,
      credit: 0,
    };

    return [customerLine, ...salesLines, ...taxLines];
  };

  const saveVoucher = async () => {
    if (!canSubmit) {
      setError('Please complete all required fields before saving.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const voucherLines = await buildVoucherLines();
      await voucherService.create({
        type: 'SALES',
        date: new Date(formState.date).toISOString(),
        number: formState.number,
        narration: formState.narration,
        lines: voucherLines,
      });
      setShowPostSaveDialog(true);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to create voucher');
    } finally {
      setSaving(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    saveVoucher();
  };

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ p: 3, backgroundColor: '#f5f6fa' }}>
      <Stack spacing={3}>
        <InvoiceHeader
          mode={mode}
          formState={{ number: formState.number, date: formState.date, dueDate: '', paymentTerms: '' }}
          onChange={(patch) => setFormState((prev) => ({ ...prev, ...patch }))}
          company={company}
          onPrint={() => window.print()}
          onClose={() => navigate('/vouchers/sales')}
        />

        <Card variant="outlined">
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={1}>
                  <Autocomplete
                    freeSolo
                    value={formState.customerName}
                    onInputChange={(_event, value) => {
                      setFormState((prev) => ({ ...prev, customerName: value || '' }));
                    }}
                    options={parties.map(p => p.name)}
                    renderInput={(params) => (
                      <TextField {...params} label="Customer Name" required fullWidth />
                    )}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => setShowQuickCreateCustomer(true)}
                    sx={{ minWidth: '120px' }}
                  >
                    + New
                  </Button>
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Narration (optional)"
                  value={formState.narration}
                  onChange={(e) => setFormState((prev) => ({ ...prev, narration: e.target.value }))}
                  fullWidth
                />
              </Grid>
              {formState.customerName && (
                <Grid item xs={12}>
                  <Stack direction="row" spacing={2}>
                    <Typography variant="body2" sx={{ pt: 1 }}>
                      <strong>Customer State:</strong> {customerState || 'Not found'}
                    </Typography>
                    <Typography variant="body2" sx={{ pt: 1, color: 'primary.main', fontWeight: 600 }}>
                      GST Type: {totals.taxType === 'CGST_SGST' ? '✓ CGST + SGST (Intra-State)' : '✓ IGST (Inter-State)'}
                    </Typography>
                  </Stack>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={3}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight={600}>
                  Line Items
                </Typography>
                <Button variant="contained" onClick={() => openDrawerForLine(null)} disabled={mode === 'view'}>
                  Add Item
                </Button>
              </Stack>
              {summaryLines.length === 0 ? (
                <Box
                  sx={{
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 4,
                    textAlign: 'center',
                    backgroundColor: '#fafafa',
                  }}
                >
                  <Typography variant="body1" fontWeight={600}>
                    No items yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    Add products to start building the invoice
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {summaryLines.map((line, index) => (
                    <Card
                      key={line.lineId}
                      variant="outlined"
                      sx={{ cursor: mode === 'view' ? 'default' : 'pointer' }}
                      onClick={() => mode === 'edit' && openDrawerForLine(index)}
                    >
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" fontWeight={600}>
                              {line.itemName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Godown: {line.godownName}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} md={2}>
                            <Typography variant="body2" color="text.secondary">
                              Qty
                            </Typography>
                            <Typography variant="subtitle1">{line.quantity.toFixed(2)}</Typography>
                          </Grid>
                          <Grid item xs={6} md={2}>
                            <Typography variant="body2" color="text.secondary">
                              Rate
                            </Typography>
                            <Typography variant="subtitle1">₹ {line.rate.toFixed(2)}</Typography>
                          </Grid>
                          <Grid item xs={6} md={2}>
                            <Typography variant="body2" color="text.secondary">
                              Tax
                            </Typography>
                            <Chip size="small" label={`${line.taxRate}%`} />
                          </Grid>
                          <Grid item xs={6} md={2}>
                            <Typography variant="body2" color="text.secondary">
                              Amount
                            </Typography>
                            <Typography variant="subtitle1" fontWeight={600}>
                              ₹ {line.amount.toFixed(2)}
                            </Typography>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Tax Bifurcation Display */}
        <Card variant="outlined" sx={{ backgroundColor: '#f9f9f9' }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>
              Totals & Tax Bifurcation {totals.taxType === 'CGST_SGST' ? '(CGST + SGST)' : '(IGST)'}
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Subtotal:</Typography>
                    <Typography variant="body2" fontWeight={600}>₹ {totals.subtotal.toFixed(2)}</Typography>
                  </Stack>
                  
                  {totals.taxType === 'CGST_SGST' ? (
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
                  
                  <Stack direction="row" justifyContent="space-between" sx={{ pt: 1, borderTop: '1px solid #ddd' }}>
                    <Typography variant="subtitle2" fontWeight={700}>Grand Total:</Typography>
                    <Typography variant="subtitle2" fontWeight={700} color="primary">₹ {totals.grandTotal.toFixed(2)}</Typography>
                  </Stack>
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>GST Type Determination:</Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>Company State Code:</strong> {companyState || 'Not set'} {companyState ? `✓` : ''}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Customer State Code:</strong> {normalizeStateToCode(customerState) || 'Not determined'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                    {statesMatch(companyState, customerState) 
                      ? '✓ States match → Intra-State (CGST+SGST)' 
                      : companyState && customerState 
                      ? '✗ States differ → Inter-State (IGST)' 
                      : 'Select a customer to determine GST type'}
                  </Typography>
                  <Chip
                    label={totals.taxType === 'CGST_SGST' ? '✓ CGST + SGST (Intra-State)' : '✓ IGST (Inter-State)'}
                    color={totals.taxType === 'CGST_SGST' ? 'success' : 'info'}
                    variant="outlined"
                    sx={{ mt: 1 }}
                  />
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <ActionFooter
          mode={mode}
          saving={saving}
          onCancel={() => navigate('/vouchers/sales')}
          onSave={saveVoucher}
          onSaveDraft={() => setMode('view')}
          onSaveAndPrint={() => {
            saveVoucher();
            try {
              const companyInfoRaw = localStorage.getItem('company-info');
              const companyLogo = localStorage.getItem('companyLogo') || '';
              const companySignature = localStorage.getItem('companySignature') || '';
              const companyInfo = companyInfoRaw ? JSON.parse(companyInfoRaw) : {};
              const company = {
                name: String(companyInfo?.name || companyInfo?.businessName || localStorage.getItem('companyName') || 'Company'),
                address: String(companyInfo?.address || ''),
                gstin: String(companyInfo?.gstin || ''),
                logo: companyLogo || undefined,
                signature: companySignature || undefined,
              };

              // Load print UI settings (page size, signature toggle, etc.)
              const uiSettingsRaw = localStorage.getItem('invoice-settings');
              const uiSettings = uiSettingsRaw ? JSON.parse(uiSettingsRaw) : {};
              const pageSize: string = uiSettings?.pageSize || 'A4';
              const orientation: string = uiSettings?.orientation || 'portrait';
              const fontSize: string = uiSettings?.fontSize || '12';
              const showSignature: boolean = Boolean(uiSettings?.showSignature ?? true);

              const format =
                pageSize === 'THERMAL_80'
                  ? 'THERMAL_80'
                  : pageSize === 'THERMAL_58'
                  ? 'THERMAL_58'
                  : pageSize === 'A5'
                  ? orientation === 'landscape'
                    ? 'A5_LANDSCAPE'
                    : 'A5_PORTRAIT'
                  : orientation === 'landscape'
                  ? 'A4_LANDSCAPE'
                  : 'A4_PORTRAIT';

              const items = summaryLines.map((l) => ({
                name: l.itemName,
                hsn: l.hsn || undefined,
                qty: l.quantity,
                rate: l.rate,
                taxPercent: l.taxRate,
                amount: l.amount,
                cgst: l.cgst || 0,
                sgst: l.sgst || 0,
                igst: l.igst || 0,
              }));

              const invoiceData = {
                invoiceNumber: formState.number,
                invoiceDate: formState.date,
                customerName: formState.customerName,
                customerGSTIN: '',
                items,
                subtotal: Number(summaryTotals.subtotal||0),
                cgstTotal: Number(summaryTotals.cgst||0),
                sgstTotal: Number(summaryTotals.sgst||0),
                igstTotal: Number(summaryTotals.igst||0),
                grandTotal: Number(summaryTotals.grandTotal||0),
                amountInWords: summaryTotals.amountInWords || '',
                declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
              } as any;

              const { buildInvoiceHTML, openPrintPreview } = require('../../../services/printService');
              const html = buildInvoiceHTML(format as any, company as any, invoiceData as any, {
                showTaxBreakup: true,
                showSignature,
                showDeclaration: true,
                logoPosition: 'top-left',
                fontSize: Number(fontSize) <= 12 ? 'compact' : 'normal',
                margin: 'normal',
              });
              openPrintPreview(html);
            } catch {
              window.print();
            }
          }}
          onEdit={() => setMode('edit')}
          onDownloadPDF={async () => {
            try {
              const { buildInvoiceHTML, downloadPDF } = require('../../../services/printService');
              const companyInfoRaw = localStorage.getItem('company-info');
              const companyLogo = localStorage.getItem('companyLogo') || '';
              const companySignature = localStorage.getItem('companySignature') || '';
              const companyInfo = companyInfoRaw ? JSON.parse(companyInfoRaw) : {};
              const company = {
                name: String(companyInfo?.name || companyInfo?.businessName || localStorage.getItem('companyName') || 'Company'),
                address: String(companyInfo?.address || ''),
                gstin: String(companyInfo?.gstin || ''),
                logo: companyLogo || undefined,
                signature: companySignature || undefined,
              };
              const uiSettingsRaw = localStorage.getItem('invoice-settings');
              const uiSettings = uiSettingsRaw ? JSON.parse(uiSettingsRaw) : {};
              const pageSize: string = uiSettings?.pageSize || 'A4';
              const orientation: string = uiSettings?.orientation || 'portrait';
              const fontSize: string = uiSettings?.fontSize || '12';
              const showSignature: boolean = Boolean(uiSettings?.showSignature ?? true);
              const format =
                pageSize === 'THERMAL_80'
                  ? 'THERMAL_80'
                  : pageSize === 'THERMAL_58'
                  ? 'THERMAL_58'
                  : pageSize === 'A5'
                  ? orientation === 'landscape'
                    ? 'A5_LANDSCAPE'
                    : 'A5_PORTRAIT'
                  : orientation === 'landscape'
                  ? 'A4_LANDSCAPE'
                  : 'A4_PORTRAIT';
              const items = summaryLines.map((l) => ({
                name: l.itemName,
                hsn: l.hsn || undefined,
                qty: l.quantity,
                rate: l.rate,
                taxPercent: l.taxRate,
                amount: l.amount,
                cgst: l.cgst || 0,
                sgst: l.sgst || 0,
                igst: l.igst || 0,
              }));
              const invoiceData = {
                invoiceNumber: formState.number,
                invoiceDate: formState.date,
                customerName: formState.customerName,
                customerGSTIN: '',
                items,
                subtotal: Number(summaryTotals.subtotal||0),
                cgstTotal: Number(summaryTotals.cgst||0),
                sgstTotal: Number(summaryTotals.sgst||0),
                igstTotal: Number(summaryTotals.igst||0),
                grandTotal: Number(summaryTotals.grandTotal||0),
                amountInWords: summaryTotals.amountInWords || '',
                declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
              } as any;
              const html = buildInvoiceHTML(format as any, company as any, invoiceData as any, {
                showTaxBreakup: true,
                showSignature,
                showDeclaration: true,
                logoPosition: 'top-left',
                fontSize: Number(fontSize) <= 12 ? 'compact' : 'normal',
                margin: 'normal',
              });
              const resPath = await downloadPDF(html, `${formState.number}.pdf`, orientation === 'landscape');
              if (resPath) alert(`PDF saved to: ${resPath}`);
            } catch (e) {
              console.error(e);
            }
          }}
          onShareWhatsApp={() => {
            try {
              const amount = Number(summaryTotals.grandTotal||0).toFixed(2);
              const msg = encodeURIComponent(
                `Invoice ${formState.number}\nAmount: ₹${amount}\nThank you for your business!`
              );
              const phone = '';
              const url = `https://wa.me/${phone ? phone : ''}?text=${msg}`;
              window.open(url, '_blank');
            } catch (e) {
              console.error(e);
            }
          }}
        />
      </Stack>
      <ItemDetailDrawer
        mode={mode}
        open={Boolean(drawerValues)}
        line={drawerValues}
        inventoryItems={inventoryItems}
        godowns={godowns}
        onChange={(patch) => setDrawerValues((prev) => (prev ? { ...prev, ...patch } : prev))}
        onClose={closeDrawer}
        onSave={handleDrawerSave}
        saving={saving}
        showValidation={showDrawerValidation}
        errors={{
          itemId: drawerValues && !drawerValues.itemId ? 'Select an item' : '',
          quantity: drawerValues && toNumber(drawerValues.quantity) <= 0 ? 'Quantity required' : '',
          rateExclusive: drawerValues && toNumber(drawerValues.rateExclusive) <= 0 ? 'Rate required' : '',
          godownId: drawerValues && !drawerValues.godownId ? 'Select a godown' : '',
        }}
        isEditing={activeLineIndex !== null}
      />
      <PostSaveActionsDialog
        open={showPostSaveDialog}
        invoiceNumber={formState.number}
        onClose={() => {
          setShowPostSaveDialog(false);
          navigate('/vouchers/sales');
        }}
        onPrint={() => {
          try {
            const companyInfoRaw = localStorage.getItem('company-info');
            const companyLogo = localStorage.getItem('companyLogo') || '';
            const companySignature = localStorage.getItem('companySignature') || '';
            const companyInfo = companyInfoRaw ? JSON.parse(companyInfoRaw) : {};
            const company = {
              name: String(companyInfo?.name || companyInfo?.businessName || localStorage.getItem('companyName') || 'Company'),
              address: String(companyInfo?.address || ''),
              gstin: String(companyInfo?.gstin || ''),
              logo: companyLogo || undefined,
              signature: companySignature || undefined,
            };
            const uiSettingsRaw = localStorage.getItem('invoice-settings');
            const uiSettings = uiSettingsRaw ? JSON.parse(uiSettingsRaw) : {};
            const pageSize: string = uiSettings?.pageSize || 'A4';
            const orientation: string = uiSettings?.orientation || 'portrait';
            const fontSize: string = uiSettings?.fontSize || '12';
            const showSignature: boolean = Boolean(uiSettings?.showSignature ?? true);
            const format =
              pageSize === 'THERMAL_80'
                ? 'THERMAL_80'
                : pageSize === 'THERMAL_58'
                ? 'THERMAL_58'
                : pageSize === 'A5'
                ? orientation === 'landscape'
                  ? 'A5_LANDSCAPE'
                  : 'A5_PORTRAIT'
                : orientation === 'landscape'
                ? 'A4_LANDSCAPE'
                : 'A4_PORTRAIT';
            const items = summaryLines.map((l) => ({
              name: l.itemName,
              hsn: l.hsn || undefined,
              qty: l.quantity,
              rate: l.rate,
              taxPercent: l.taxRate,
              amount: l.amount,
              cgst: l.cgst || 0,
              sgst: l.sgst || 0,
              igst: l.igst || 0,
            }));
            const invoiceData = {
              invoiceNumber: formState.number,
              invoiceDate: formState.date,
              customerName: formState.customerName,
              customerGSTIN: '',
              items,
              subtotal: Number(summaryTotals.subtotal||0),
              cgstTotal: Number(summaryTotals.cgst||0),
              sgstTotal: Number(summaryTotals.sgst||0),
              igstTotal: Number(summaryTotals.igst||0),
              grandTotal: Number(summaryTotals.grandTotal||0),
              amountInWords: summaryTotals.amountInWords || '',
              declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
            } as any;
            const { buildInvoiceHTML, openPrintPreview } = require('../../../services/printService');
            const html = buildInvoiceHTML(format as any, company as any, invoiceData as any, {
              showTaxBreakup: true,
              showSignature,
              showDeclaration: true,
              logoPosition: 'top-left',
              fontSize: Number(fontSize) <= 12 ? 'compact' : 'normal',
              margin: 'normal',
            });
            openPrintPreview(html);
          } catch (e) {
            console.error(e);
          }
        }}
        onDownloadPDF={async () => {
          try {
            const { buildInvoiceHTML, downloadPDF } = require('../../../services/printService');
            const companyInfoRaw = localStorage.getItem('company-info');
            const companyLogo = localStorage.getItem('companyLogo') || '';
            const companySignature = localStorage.getItem('companySignature') || '';
            const companyInfo = companyInfoRaw ? JSON.parse(companyInfoRaw) : {};
            const company = {
              name: String(companyInfo?.name || companyInfo?.businessName || localStorage.getItem('companyName') || 'Company'),
              address: String(companyInfo?.address || ''),
              gstin: String(companyInfo?.gstin || ''),
              logo: companyLogo || undefined,
              signature: companySignature || undefined,
            };
            const uiSettingsRaw = localStorage.getItem('invoice-settings');
            const uiSettings = uiSettingsRaw ? JSON.parse(uiSettingsRaw) : {};
            const pageSize: string = uiSettings?.pageSize || 'A4';
            const orientation: string = uiSettings?.orientation || 'portrait';
            const fontSize: string = uiSettings?.fontSize || '12';
            const showSignature: boolean = Boolean(uiSettings?.showSignature ?? true);
            const format =
              pageSize === 'THERMAL_80'
                ? 'THERMAL_80'
                : pageSize === 'THERMAL_58'
                ? 'THERMAL_58'
                : pageSize === 'A5'
                ? orientation === 'landscape'
                  ? 'A5_LANDSCAPE'
                  : 'A5_PORTRAIT'
                : orientation === 'landscape'
                ? 'A4_LANDSCAPE'
                : 'A4_PORTRAIT';
            const items = summaryLines.map((l) => ({
              name: l.itemName,
              hsn: l.hsn || undefined,
              qty: l.quantity,
              rate: l.rate,
              taxPercent: l.taxRate,
              amount: l.amount,
              cgst: l.cgst || 0,
              sgst: l.sgst || 0,
              igst: l.igst || 0,
            }));
            const invoiceData = {
              invoiceNumber: formState.number,
              invoiceDate: formState.date,
              customerName: formState.customerName,
              customerGSTIN: '',
              items,
              subtotal: Number(summaryTotals.subtotal||0),
              cgstTotal: Number(summaryTotals.cgst||0),
              sgstTotal: Number(summaryTotals.sgst||0),
              igstTotal: Number(summaryTotals.igst||0),
              grandTotal: Number(summaryTotals.grandTotal||0),
              amountInWords: summaryTotals.amountInWords || '',
              declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
            } as any;
            const html = buildInvoiceHTML(format as any, company as any, invoiceData as any, {
              showTaxBreakup: true,
              showSignature,
              showDeclaration: true,
              logoPosition: 'top-left',
              fontSize: Number(fontSize) <= 12 ? 'compact' : 'normal',
              margin: 'normal',
            });
            const resPath = await downloadPDF(html, `${formState.number}.pdf`, orientation === 'landscape');
            if (resPath) alert(`PDF saved to: ${resPath}`);
          } catch (e) {
            console.error(e);
          }
        }}
        onShareWhatsApp={() => {
          try {
            const amount = Number(summaryTotals.grandTotal||0).toFixed(2);
            const msg = encodeURIComponent(
              `Invoice ${formState.number}\nAmount: ₹${amount}\nThank you for your business!`
            );
            const phone = '';
            const url = `https://wa.me/${phone ? phone : ''}?text=${msg}`;
            window.open(url, '_blank');
          } catch (e) {
            console.error(e);
          }
        }}
      />
      <QuickCreateCustomerDialog
        open={showQuickCreateCustomer}
        onClose={() => setShowQuickCreateCustomer(false)}
        onSave={(customerName) => {
          setFormState((prev) => ({ ...prev, customerName }));
        }}
      />
    </Box>
  );
};

export default memo(SalesVoucherFormNew);
