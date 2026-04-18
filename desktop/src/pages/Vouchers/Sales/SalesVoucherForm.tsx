import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, Grid, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, Paper, Chip, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import { ledgerAccountService } from '../../../services/masters/ledgerAccountService';
import { partyService } from '../../../services/masters/partyService';
import { inventoryItemService } from '../../../services/masters/inventoryItemService';
import { godownService } from '../../../services/masters/godownService';
import { voucherService } from '../../../services/vouchers/voucherService';
import { LedgerAccount, InventoryItem, Godown } from '../../../types/masters';
import { Party } from '../../../types/party';
import { usePermission } from '../../../hooks/usePermission';
import { focusRegistry } from '../../../services/focus/focusRegistry';
import { useFocusField } from '../../../hooks/useFocusField';
import { generateId } from '../../../utils/id';
import InvoiceHeader from './components/InvoiceHeader';
import PartyCards, { PartyInfo } from './components/PartyCards';
import ActionFooter from './components/ActionFooter';
import AdditionalCharges, { AdditionalChargeState } from './components/AdditionalCharges';
import { decideGSTType } from '../../../services/vouchers/gstDecisionEngine';
import { bifurcateTax } from '../../../services/vouchers/gstBifurcationEngine';
import { buildSalesVoucherLinesWithGST } from '../../../services/vouchers/salesVoucherGSTBuilder';
import { getAppSettings } from '../../../services/appSettingsService';
import QuickCreateLedgerDialog from '../../../components/QuickCreateLedgerDialog';
import PartyMasterDialog from '../../../components/PartyMasterDialog';
import InventoryItemMasterDialog from '../../../components/InventoryItemMasterDialog';
import { TallyListPickerModal } from './components/TallyListPickerModal';
import { rateMemory } from '../../../services/reports/rateMemory';

interface ItemLineState {
  lineId: string;
  itemId: string;
  quantity: string;
  rateExclusive: string;
  rateInclusive: string;
  taxRate: string;
  godownId: string;
}

const SCREEN_ID = 'sales-voucher-form';

const buildLineFieldId = (lineId: string, field: string) => `sales-line-${lineId}-${field}`;

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

const SalesVoucherForm = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreate = can('create-vouchers');

  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
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
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalChargeState[]>([]);
  const [enableRoundOff, setEnableRoundOff] = useState(true);
  const [companyState, setCompanyState] = useState<string>(''); // Will be loaded from company config

  // Quick create ledger dialogs
  const [showQuickCreateCustomer, setShowQuickCreateCustomer] = useState(false);
  const [showQuickCreateSales, setShowQuickCreateSales] = useState(false);
  const [showQuickCreateItem, setShowQuickCreateItem] = useState(false);
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [itemPickerLineId, setItemPickerLineId] = useState<string | null>(null);

  const linesRef = useRef(lines);
  const itemPickerLineIdRef = useRef(itemPickerLineId);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);
  useEffect(() => {
    itemPickerLineIdRef.current = itemPickerLineId;
  }, [itemPickerLineId]);

  const blockEscapeBackRef = useRef(false);
  useEffect(() => {
    blockEscapeBackRef.current =
      partyPickerOpen ||
      itemPickerLineId !== null ||
      showQuickCreateCustomer ||
      showQuickCreateItem ||
      showQuickCreateSales;
  }, [
    partyPickerOpen,
    itemPickerLineId,
    showQuickCreateCustomer,
    showQuickCreateItem,
    showQuickCreateSales,
  ]);

  /** Escape on the main form (no open dialog) → same as Back: return to sales list. */
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (blockEscapeBackRef.current) return;
      const el = e.target as HTMLElement | null;
      if (!el?.isConnected) return;
      if (el.closest?.('[role="dialog"], [data-tally-picker-modal]')) return;
      e.preventDefault();
      navigate('/vouchers/sales');
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [navigate]);

  const [formState, setFormState] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    number: '', // Will be generated in useEffect
    customerLedgerId: '',
    salesLedgerId: '',
    gstLedgerId: '',
    defaultGodownId: '',
    termsAndConditions: '',
    notes: '',
    narration: '',
    discountPercent: '0',
    discountAmount: '0',
    freightAmount: '0',
  });

  const [partyDraft, setPartyDraft] = useState<{ billing: PartyInfo; shipping: PartyInfo }>({
    billing: {} as PartyInfo,
    shipping: {} as PartyInfo,
  });

  useEffect(() => {
    // Generate initial invoice number based on settings
    const settings = getAppSettings();
    const inv = settings.invoiceNumbering;
    const prefix = inv?.prefix ?? 'INV-';
    const suffix = inv?.suffix ?? '';
    const startNum = inv?.startingNumber ?? 1;
    
    // In a real app, you'd check the DB for the next available number.
    // For now, we'll use the starting number from settings.
    setFormState(prev => ({
      ...prev,
      number: `${prefix}${String(startNum).padStart(3, '0')}${suffix}`
    }));
  }, []);

  useEffect(() => {
    // Load company state from localStorage
    const savedCompanyState = localStorage.getItem('companyState');
    if (savedCompanyState) {
      setCompanyState(savedCompanyState);
    }

    // Load parties for sales (BUYER + BOTH types)
    partyService
      .listForSales()
      .then(setParties)
      .catch(() => setParties([]));
    
    // Keep ledger accounts for other purposes (sales ledger, gst ledger, etc.)
    ledgerAccountService
      .list({ includeInactive: false })
      .then(setLedgerAccounts)
      .catch(() => setLedgerAccounts([]));
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

  const itemMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventoryItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [inventoryItems]);

  const getItemName = useCallback(
    (itemId: string) => itemMap.get(itemId)?.name ?? itemId,
    [itemMap]
  );

  const updateLine = useCallback(
    (index: number, patch: Partial<ItemLineState>) => {
      setLines((prev) =>
        prev.map((line, idx) => {
          if (idx !== index) return line;
          const next = { ...line, ...patch };
          if (patch.itemId) {
            const selectedItem = itemMap.get(patch.itemId);
            if (selectedItem && selectedItem.gstRate != null) {
              next.taxRate = String(selectedItem.gstRate);
              next.rateInclusive = '';
            }
          }
          return next;
        })
      );
    },
    [itemMap]
  );

  const addLine = useCallback(() => {
    setLines((prev) => {
      const newLine = createLine(formState.defaultGodownId);
      focusRegistry.queueFocus(buildLineFieldId(newLine.lineId, 'item'));
      return [...prev, newLine];
    });
  }, [formState.defaultGodownId]);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  }, []);

  const totals = useMemo(() => {
    // Line item subtotal (pre-tax)
    const subtotal = lines.reduce((sum, line) => sum + computeLineAmount(line), 0);
    
    // Item GST
    const taxTotal = lines.reduce((sum, line) => sum + computeLineTax(line), 0);
    
    // Additional charges
    const chargesTotal = additionalCharges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0);
    
    // Charge GST (if taxable)
    const chargeGSTTotal = additionalCharges.reduce((sum, charge) => {
      if (!charge.isTaxable) return sum;
      const amount = Number(charge.amount) || 0;
      const gstPercent = Number(charge.gstPercent) || 0;
      return sum + (amount * gstPercent) / 100;
    }, 0);
    
    // Grand total before round-off
    const totalBeforeRoundOff = subtotal + taxTotal + chargesTotal + chargeGSTTotal;
    
    // Round-off (to nearest ₹1)
    const roundOff = enableRoundOff ? Math.round(totalBeforeRoundOff) - totalBeforeRoundOff : 0;
    
    // Final grand total
    const grandTotal = Number((totalBeforeRoundOff + roundOff).toFixed(2));

    // GST Decision using new engine
    // Create a party object from the current billing party draft
    const partyFromDraft: Party = {
      id: partyDraft.billing.ledgerId || '',
      name: partyDraft.billing.name || '',
      gstin: partyDraft.billing.gstin || '',
      state: partyDraft.billing.state || '',
      mobile: partyDraft.billing.phone || '',
      email: partyDraft.billing.email || '',
      address: partyDraft.billing.address || '',
      pincode: partyDraft.billing.pin || '',
      partyType: 'BUYER',
      ledgerId: partyDraft.billing.ledgerId || '',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const gstDecision = decideGSTType(partyFromDraft, companyState);
    
    // Calculate average GST rate from items
    const avgGstRate = lines.length > 0
      ? lines.reduce((sum, line) => sum + (Number(line.taxRate) || 0), 0) / lines.length
      : 0;
    
    // Bifurcate item tax
    const itemTaxBifurcated = bifurcateTax(taxTotal, avgGstRate, gstDecision.taxType);
    
    // Bifurcate charge tax
    const chargeGstRate = additionalCharges.length > 0 ? (Number(additionalCharges[0].gstPercent) || 0) : 0;
    const chargeGstBifurcated = additionalCharges.length > 0 
      ? bifurcateTax(chargeGSTTotal, chargeGstRate, gstDecision.taxType)
      : { type: gstDecision.taxType, cgst: 0, sgst: 0, igst: 0, total: 0 };

    return {
      subtotal: Number(subtotal.toFixed(2)),
      itemTax: taxTotal,
      itemTaxBifurcated,
      chargesTotal: Number(chargesTotal.toFixed(2)),
      chargeTax: Number(chargeGSTTotal.toFixed(2)),
      chargeTaxBifurcated: chargeGstBifurcated,
      roundOff: Number(roundOff.toFixed(2)),
      grandTotal,
      supplyType: gstDecision.supplyType,
      taxType: gstDecision.taxType,
      gstDecision,
    };
  }, [lines, additionalCharges, enableRoundOff, companyState, partyDraft.billing.gstin, partyDraft.billing.state]);

  const lookupLedgerName = (ledgerId: string) =>
    ledgerAccounts.find((acct) => acct.id === ledgerId)?.name ?? ledgerId;

  const postingPreview = useMemo(() => {
    const entries: { ledgerId: string; ledgerName: string; debit: number; credit: number; description?: string }[] = [];
    
    // 1. Debit Customer with grand total (always show if customer selected)
    if (formState.customerLedgerId) {
      entries.push({
        ledgerId: formState.customerLedgerId,
        ledgerName: lookupLedgerName(formState.customerLedgerId),
        debit: totals.grandTotal,
        credit: 0,
        description: 'Customer (Sales Invoice)',
      });
    }
    
    // 2. Credit Sales (always show if sales selected and has items)
    if (formState.salesLedgerId && totals.subtotal > 0) {
      entries.push({
        ledgerId: formState.salesLedgerId,
        ledgerName: lookupLedgerName(formState.salesLedgerId),
        debit: 0,
        credit: totals.subtotal,
        description: `Sales (${lines.filter(l => l.itemId && Number(l.quantity) > 0).length} items)`,
      });
    }
    
    // 3. Credit Additional Charges (each to its own line if present)
    additionalCharges.forEach((charge) => {
      const amount = Number(charge.amount) || 0;
      if (amount > 0) {
        entries.push({
          ledgerId: charge.ledgerId || 'unknown-charge',
          ledgerName: charge.name,
          debit: 0,
          credit: amount,
          description: `${charge.name} Charge`,
        });
      }
    });
    
    // 4. Credit Item GST (CGST/SGST or IGST - NEVER MIXED)
    if (totals.itemTax > 0) {
      if (totals.gstDecision.isLocalTransaction) {
        // INTRA-STATE: Show CGST and SGST separately
        if (totals.itemTaxBifurcated.cgst > 0) {
          entries.push({
            ledgerId: 'cgst-output',
            ledgerName: 'CGST Output',
            debit: 0,
            credit: totals.itemTaxBifurcated.cgst,
            description: `CGST on Sales Items`,
          });
        }
        if (totals.itemTaxBifurcated.sgst > 0) {
          entries.push({
            ledgerId: 'sgst-output',
            ledgerName: 'SGST Output',
            debit: 0,
            credit: totals.itemTaxBifurcated.sgst,
            description: `SGST on Sales Items`,
          });
        }
      } else {
        // INTER-STATE: Show IGST only
        if (totals.itemTaxBifurcated.igst > 0) {
          entries.push({
            ledgerId: 'igst-output',
            ledgerName: 'IGST Output',
            debit: 0,
            credit: totals.itemTaxBifurcated.igst,
            description: `IGST on Sales Items`,
          });
        }
      }
    }
    
    // 5. Credit Charge GST (bifurcated same as item tax)
    if (totals.chargeTax > 0) {
      if (totals.gstDecision.isLocalTransaction) {
        if (totals.chargeTaxBifurcated.cgst > 0) {
          entries.push({
            ledgerId: 'cgst-output',
            ledgerName: 'CGST Output',
            debit: 0,
            credit: totals.chargeTaxBifurcated.cgst,
            description: `CGST on Charges`,
          });
        }
        if (totals.chargeTaxBifurcated.sgst > 0) {
          entries.push({
            ledgerId: 'sgst-output',
            ledgerName: 'SGST Output',
            debit: 0,
            credit: totals.chargeTaxBifurcated.sgst,
            description: `SGST on Charges`,
          });
        }
      } else {
        if (totals.chargeTaxBifurcated.igst > 0) {
          entries.push({
            ledgerId: 'igst-output',
            ledgerName: 'IGST Output',
            debit: 0,
            credit: totals.chargeTaxBifurcated.igst,
            description: `IGST on Charges`,
          });
        }
      }
    }
    
    // 6. Round-Off (if enabled and non-zero) - post to Round-Off ledger
    if (enableRoundOff && totals.roundOff !== 0) {
      if (totals.roundOff > 0) {
        // Round-off is gain (we owe customer less)
        entries.push({
          ledgerId: 'round-off',
          ledgerName: 'Round Off',
          debit: 0,
          credit: totals.roundOff,
          description: `Round-off gain ₹${totals.roundOff.toFixed(2)}`,
        });
      } else {
        // Round-off is loss (we owe customer more)
        entries.push({
          ledgerId: 'round-off',
          ledgerName: 'Round Off',
          debit: Math.abs(totals.roundOff),
          credit: 0,
          description: `Round-off loss ₹${Math.abs(totals.roundOff).toFixed(2)}`,
        });
      }
    }
    
    return entries;
  }, [formState.customerLedgerId, formState.salesLedgerId, totals, ledgerAccounts, additionalCharges, enableRoundOff, lines]);

  const postingBalanced = useMemo(() => {
    const totalDebit = postingPreview.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = postingPreview.reduce((sum, entry) => sum + entry.credit, 0);
    return totalDebit > 0 && Number(totalDebit.toFixed(2)) === Number(totalCredit.toFixed(2));
  }, [postingPreview]);

  const stockPreview = useMemo(
    () =>
      lines
        .filter(isLineDataValid)
        .map((line) => ({
          itemName: inventoryItems.find((item) => item.id === line.itemId)?.name ?? line.itemId,
          quantity: Number(line.quantity) || 0,
          godownName: godowns.find((godown) => godown.id === line.godownId)?.name ?? line.godownId,
        })),
    [lines, inventoryItems, godowns]
  );

  const gstRequired = useMemo(() => lines.some((line) => Number(line.taxRate) > 0), [lines]);
  const gstOverrides = useMemo(() => {
    const overrides: { itemName: string; defaultRate: number; appliedRate: number }[] = [];
    lines.forEach((line) => {
      if (!line.itemId) return;
      const product = itemMap.get(line.itemId);
      if (!product || product.gstRate == null) return;
      const defaultRate = Number(product.gstRate ?? 0);
      const appliedRate = Number(line.taxRate || 0);
      if (defaultRate !== appliedRate) {
        overrides.push({
          itemName: getItemName(line.itemId),
          defaultRate,
          appliedRate,
        });
      }
    });
    return overrides;
  }, [lines, itemMap, getItemName]);

  const canSubmit =
    canCreate &&
    formState.date &&
    formState.number &&
    formState.customerLedgerId &&
    formState.salesLedgerId &&
    lines.every(isLineDataValid) &&
    (!gstRequired || Boolean(formState.gstLedgerId)) &&
    postingBalanced &&
    !saving;

  const buildVoucherLines = async () => {
    // Build GST-bifurcated voucher lines with proper tax splitting
    const lineItems = lines
      .filter((line) => line.itemId && Number(line.quantity) > 0)
      .map((line) => ({
        itemId: line.itemId,
        quantity: Number(line.quantity),
        amount: computeLineAmount(line),
        gstPercent: Number(line.taxRate) || 0,
        godownId: line.godownId,
      }));

    // Convert additional charges to the format needed by the builder
    const chargesForBuilder = additionalCharges
      .filter((c) => Number(c.amount) > 0)
      .map((c) => ({
        id: c.chargeId,
        name: c.name,
        amount: Number(c.amount),
        isTaxable: c.isTaxable,
        gstPercent: Number(c.gstPercent) || 0,
      }));

    // Get company state (for now, from localStorage or default)
    const companyStateValue = 
      companyState || 
      localStorage.getItem('companyState') || 
      'IN'; // Fallback

    // Create party object from draft for GST decision
    const partyFromDraft: Party = {
      id: partyDraft.billing.ledgerId || '',
      name: partyDraft.billing.name || '',
      gstin: partyDraft.billing.gstin || '',
      state: partyDraft.billing.state || '',
      mobile: partyDraft.billing.phone || '',
      email: partyDraft.billing.email || '',
      address: partyDraft.billing.address || '',
      pincode: partyDraft.billing.pin || '',
      partyType: 'BUYER',
      ledgerId: partyDraft.billing.ledgerId || '',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Use the GST builder to create properly bifurcated voucher lines
    const { lines: voucherLines } = await buildSalesVoucherLinesWithGST({
      customerLedgerId: formState.customerLedgerId,
      salesLedgerId: formState.salesLedgerId,
      lines: lineItems,
      additionalCharges: chargesForBuilder,
      companyState: companyStateValue,
      partyState: partyDraft.billing.state || '',
      narration: formState.narration,
    });

    return voucherLines;
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
      const custId = formState.customerLedgerId;
      if (custId) {
        for (const line of lines) {
          const ex = toNumber(line.rateExclusive);
          if (line.itemId && ex > 0) {
            rateMemory.setLastSaleExclusive(custId, line.itemId, ex);
          }
        }
      }
      navigate('/vouchers/sales');
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

  const billingLedger = ledgerAccounts.find((acct) => acct.id === formState.customerLedgerId);
  const billingParty: PartyInfo = {
    ledgerId: formState.customerLedgerId,
    name: billingLedger?.name ?? partyDraft.billing.name,
    gstin: billingLedger?.gstDetails?.gstin ?? partyDraft.billing.gstin,
    address: billingLedger?.contactDetails?.address ?? partyDraft.billing.address,
    phone: billingLedger?.contactDetails?.phone ?? partyDraft.billing.phone,
    email: billingLedger?.contactDetails?.email ?? partyDraft.billing.email,
    city: partyDraft.billing.city,
    state: partyDraft.billing.state,
    pin: partyDraft.billing.pin,
  };

  const shippingParty: PartyInfo = {
    ledgerId: partyDraft.shipping.ledgerId ?? billingParty.ledgerId,
    name: partyDraft.shipping.name ?? billingParty.name,
    gstin: partyDraft.shipping.gstin ?? billingParty.gstin,
    address: partyDraft.shipping.address ?? billingParty.address,
    phone: partyDraft.shipping.phone ?? billingParty.phone,
    email: partyDraft.shipping.email ?? billingParty.email,
    city: partyDraft.shipping.city ?? billingParty.city,
    state: partyDraft.shipping.state ?? billingParty.state,
    pin: partyDraft.shipping.pin ?? billingParty.pin,
  };

  const handlePartyChange = (patch: { billing?: Partial<PartyInfo>; shipping?: Partial<PartyInfo> }) => {
    setPartyDraft((prev) => ({
      billing: { ...prev.billing, ...(patch.billing ?? {}) },
      shipping: { ...prev.shipping, ...(patch.shipping ?? {}) },
    }));
    if (patch.billing?.ledgerId !== undefined) {
      setFormState((prev) => ({ ...prev, customerLedgerId: patch.billing!.ledgerId || '' }));
    }
  };

  const handleInventoryMasterSaved = (newItem: InventoryItem) => {
    setInventoryItems((prev) => [...prev, newItem]);
    const mem =
      formState.customerLedgerId && newItem.id
        ? rateMemory.getLastSaleExclusive(formState.customerLedgerId, newItem.id)
        : null;
    const sale = mem ?? Number(newItem.pricing?.sale ?? 0);
    const gst = Number(newItem.gstRate ?? 0);
    setLines((prev) => {
      const updatedLines = [...prev];
      const emptyLineIndex = updatedLines.findIndex((line) => !line.itemId);
      const targetIdx = emptyLineIndex >= 0 ? emptyLineIndex : updatedLines.length - 1;
      const inclusive = gst ? sale * (1 + gst / 100) : sale;
      updatedLines[targetIdx] = {
        ...updatedLines[targetIdx],
        itemId: newItem.id,
        rateExclusive: String(sale),
        rateInclusive: Number.isFinite(inclusive) ? inclusive.toFixed(2) : String(sale),
        taxRate: String(gst),
      };
      return updatedLines;
    });
    setShowQuickCreateItem(false);
  };

  return (
    <Box component="form" onSubmit={handleFormSubmit}>
      <Stack spacing={3}>
        <Button
          type="button"
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/vouchers/sales')}
          sx={{ alignSelf: 'flex-start' }}
        >
          Back to sales vouchers
        </Button>

        <InvoiceHeader
          mode={mode}
          formState={{ number: formState.number, date: formState.date, dueDate: '', paymentTerms: '' }}
          onChange={(patch) => setFormState((prev) => ({ ...prev, ...patch }))}
          onPrint={() => window.print()}
          onClose={() => navigate('/vouchers/sales')}
        />

        <PartyCards
          mode={mode}
          billing={billingParty}
          shipping={shippingParty}
          parties={parties}
          ledgers={ledgerAccounts}
          onChange={handlePartyChange}
          onQuickCreateCustomer={() => {
            setPartyPickerOpen(false);
            setShowQuickCreateCustomer(true);
          }}
          billingCustomerSelector="picker"
          onOpenBillingCustomerPicker={() => setPartyPickerOpen(true)}
        />

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {gstOverrides.length > 0 && (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            GST rate overridden for {gstOverrides.length} item{gstOverrides.length > 1 ? 's' : ''}. If the new rate is
            meant to stay, edit the inventory master so future invoices stay accurate. Example: {gstOverrides[0].itemName}{' '}
            ({gstOverrides[0].defaultRate}% → {gstOverrides[0].appliedRate}%)
          </Alert>
        )}

        <Card>
          <CardContent>
            <Stack spacing={3}>
              <Typography variant="subtitle1" fontWeight={600}>
                Line Items
              </Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ '& td': { verticalAlign: 'top' }, minWidth: 1000 }}>
                  <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 200 }}>Item</TableCell>
                    <TableCell sx={{ minWidth: 100, width: 100 }}>Quantity</TableCell>
                    <TableCell sx={{ minWidth: 100, width: 100 }}>Rate</TableCell>
                    <TableCell sx={{ minWidth: 80, width: 80 }}>Tax %</TableCell>
                    <TableCell sx={{ minWidth: 140, width: 140 }}>Godown</TableCell>
                    <TableCell sx={{ minWidth: 120, width: 120 }} align="right">Amount</TableCell>
                    <TableCell sx={{ minWidth: 80, width: 80 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((line, index) => (
                    <SalesLineRow
                      key={line.lineId}
                      line={line}
                      index={index}
                      godowns={godowns}
                      updateLine={updateLine}
                      removeLine={removeLine}
                      isLastRow={index === lines.length - 1}
                      disableRemove={lines.length === 1}
                      onRequestAddLine={addLine}
                      onValidationError={setError}
                      requireGodown={godowns.length > 0}
                      getItemDisplayName={(id) => getItemName(id)}
                      onOpenItemPicker={(rowIndex) => {
                        const lid = lines[rowIndex]?.lineId;
                        if (lid) setItemPickerLineId(lid);
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
              </Box>
              <Button variant="text" startIcon={<AddIcon />} onClick={addLine} sx={{ alignSelf: 'flex-start' }}>
                Add Line
              </Button>
            </Stack>

            {/* Additional Charges Section */}
            <AdditionalCharges
              charges={additionalCharges}
              onChange={setAdditionalCharges}
              readOnly={mode === 'view'}
            />

            {/* Round-Off Toggle */}
            <Box sx={{ p: 2, backgroundColor: '#f9f9f9', borderRadius: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={enableRoundOff}
                    onChange={(e) => setEnableRoundOff(e.target.checked)}
                    disabled={mode === 'view'}
                  />
                }
                label="Enable Automatic Round-Off (to nearest ₹1)"
              />
            </Box>

            <Stack spacing={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                Totals & Tax Bifurcation ({totals.gstDecision.isLocalTransaction ? 'CGST + SGST' : 'IGST'})
              </Typography>
              <Stack spacing={1.5}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1 }}>
                  <Typography variant="body2">Subtotal: <strong>₹{totals.subtotal.toFixed(2)}</strong></Typography>
                  
                  {totals.gstDecision.isLocalTransaction ? (
                    <>
                      <Typography variant="body2">CGST (Item): <strong>₹{totals.itemTaxBifurcated.cgst.toFixed(2)}</strong></Typography>
                      <Typography variant="body2">SGST (Item): <strong>₹{totals.itemTaxBifurcated.sgst.toFixed(2)}</strong></Typography>
                    </>
                  ) : (
                    <Typography variant="body2">IGST (Item): <strong>₹{totals.itemTaxBifurcated.igst.toFixed(2)}</strong></Typography>
                  )}
                  
                  {totals.chargesTotal > 0 && (
                    <Typography variant="body2">Additional Charges: <strong>₹{totals.chargesTotal.toFixed(2)}</strong></Typography>
                  )}
                  
                  {totals.chargeTax > 0 && totals.gstDecision.isLocalTransaction ? (
                    <>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>CGST (Charges): <strong>₹{totals.chargeTaxBifurcated.cgst.toFixed(2)}</strong></Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>SGST (Charges): <strong>₹{totals.chargeTaxBifurcated.sgst.toFixed(2)}</strong></Typography>
                    </>
                  ) : totals.chargeTax > 0 ? (
                    <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>IGST (Charges): <strong>₹{totals.chargeTaxBifurcated.igst.toFixed(2)}</strong></Typography>
                  ) : null}
                  
                  {totals.roundOff !== 0 && (
                    <Typography variant="body2" sx={{ color: totals.roundOff > 0 ? 'green' : 'red' }}>
                      Round-Off: <strong>₹{totals.roundOff > 0 ? '+' : ''}{totals.roundOff.toFixed(2)}</strong>
                    </Typography>
                  )}
                </Box>
                
                <Box sx={{ borderTop: '2px solid #ddd', pt: 1, mt: 1 }}>
                  <Typography variant="body1" fontWeight={700} color="primary">
                    Grand Total: ₹ {totals.grandTotal.toFixed(2)}
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            <Grid container spacing={2}>
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
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Stock Impact Preview
                    </Typography>
                    {stockPreview.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No stock impact yet. Add line items with quantity and godown.
                      </Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Item</TableCell>
                            <TableCell>Godown</TableCell>
                            <TableCell align="right">Quantity</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {stockPreview.map((entry, idx) => (
                            <TableRow key={`${entry.itemName}-${idx}`}>
                              <TableCell>{entry.itemName}</TableCell>
                              <TableCell>{entry.godownName}</TableCell>
                              <TableCell align="right">-{entry.quantity.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

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

        <ActionFooter
          mode={mode}
          saving={saving}
          onCancel={() => navigate('/vouchers/sales')}
          onSave={handleFormSubmit as any}
          onSaveDraft={() => setMode('view')}
          onSaveAndPrint={() => {
            handleFormSubmit({ preventDefault: () => {} } as any);
            window.print();
          }}
          onEdit={() => setMode('edit')}
        />

        {/* Party Master (popup) — new customer from voucher */}
        <PartyMasterDialog
          open={showQuickCreateCustomer}
          onClose={() => setShowQuickCreateCustomer(false)}
          onSaved={async (party) => {
            const [partiesList, ledgers] = await Promise.all([
              partyService.listForSales(),
              ledgerAccountService.list({ includeInactive: false }),
            ]);
            setParties(partiesList);
            setLedgerAccounts(ledgers);
            const ledgerId = party.ledgerId || '';
            setFormState((prev) => ({ ...prev, customerLedgerId: ledgerId }));
            setPartyDraft((prev) => ({
              ...prev,
              billing: {
                ledgerId,
                name: party.name,
                gstin: party.gstin,
                phone: party.mobile,
                email: party.email,
                address: party.address,
                city: party.city,
                state: party.state,
                pin: party.pincode,
              },
            }));
          }}
        />

        <QuickCreateLedgerDialog
          open={showQuickCreateSales}
          onClose={() => setShowQuickCreateSales(false)}
          ledgerType="SALES"
          title="Create New Sales Account"
          onSave={(ledgerId, ledgerName) => {
            setLedgerAccounts((prev) => [
              ...prev,
              { id: ledgerId, name: ledgerName, groupId: 'grp-sales', status: 'ACTIVE' } as any,
            ]);
            setFormState((prev) => ({ ...prev, salesLedgerId: ledgerId }));
          }}
        />

        <InventoryItemMasterDialog
          open={showQuickCreateItem}
          onClose={() => setShowQuickCreateItem(false)}
          onSaved={handleInventoryMasterSaved}
        />

        <TallyListPickerModal<Party>
          open={partyPickerOpen}
          onClose={() => setPartyPickerOpen(false)}
          title="List of Ledger Accounts"
          searchPlaceholder="Search party name, alias, or GSTIN…"
          rows={parties}
          getRowKey={(p) => String(p.ledgerId ?? p.id)}
          filterRow={(p, q) => {
            const s = q.trim().toLowerCase();
            if (!s) return true;
            const name = (p.name || '').toLowerCase();
            const g = (p.gstin || '').toLowerCase();
            const mobile = (p.mobile || '').toLowerCase();
            return name.includes(s) || g.includes(s) || mobile.includes(s);
          }}
          columns={[
            {
              id: 'name',
              header: 'Party Name',
              render: (p) => <Typography fontWeight={600}>{p.name}</Typography>,
            },
            {
              id: 'bal',
              header: 'Outstanding Balance',
              align: 'right',
              render: (p) => {
                const n = Number(p.currentBalance ?? p.openingBalance ?? 0);
                return <Typography variant="body2">₹{Number.isFinite(n) ? n.toFixed(2) : '0.00'}</Typography>;
              },
            },
            {
              id: 'gstin',
              header: 'GSTIN',
              render: (p) => (
                <Typography variant="body2" color="text.secondary">
                  {p.gstin || '—'}
                </Typography>
              ),
            },
          ]}
          onSelect={(selectedParty) => {
            setPartyPickerOpen(false);
            const ledgerId = selectedParty.ledgerId || '';
            handlePartyChange({
              billing: {
                ledgerId,
                name: selectedParty.name,
                gstin: selectedParty.gstin,
                address: selectedParty.address,
                phone: selectedParty.mobile,
                email: selectedParty.email,
                city: selectedParty.city,
                state: selectedParty.state,
                pin: selectedParty.pincode,
              },
            });
          }}
          onCreateNew={() => {
            setPartyPickerOpen(false);
            setShowQuickCreateCustomer(true);
          }}
          createNewLabel="+ Create New Party"
          emptyMessage="No parties found."
        />

        <TallyListPickerModal<InventoryItem>
          sessionKey={itemPickerLineId}
          open={itemPickerLineId !== null}
          onClose={() => setItemPickerLineId(null)}
          title="List of Inventory Items"
          searchPlaceholder="Search item name, SKU, or barcode…"
          rows={inventoryItems}
          getRowKey={(it) => it.id}
          filterRow={(it, q) => {
            const s = q.trim().toLowerCase();
            if (!s) return true;
            const name = (it.name || '').toLowerCase();
            const sku = (it.sku || '').toLowerCase();
            const bc = (it.barcode || '').toLowerCase();
            const hsn = (it.hsnCode || '').toLowerCase();
            return name.includes(s) || sku.includes(s) || bc.includes(s) || hsn.includes(s);
          }}
          columns={[
            {
              id: 'name',
              header: 'Item',
              render: (it) => (
                <Box>
                  <Typography fontWeight={700}>{it.name}</Typography>
                  {it.sku ? (
                    <Typography variant="caption" color="text.secondary" display="block">
                      SKU: {it.sku}
                    </Typography>
                  ) : null}
                </Box>
              ),
            },
            {
              id: 'hsn',
              header: 'HSN',
              width: 100,
              render: (it) => (
                <Typography variant="body2" fontWeight={600}>
                  {it.hsnCode?.trim() ? it.hsnCode : '—'}
                </Typography>
              ),
            },
            {
              id: 'qty',
              header: 'Stock (Qty)',
              width: 110,
              align: 'right',
              render: (it) => {
                const q = Number(it.currentStock);
                const t = Number.isFinite(q) ? q : 0;
                return (
                  <Typography variant="body2" fontWeight={600}>
                    {Number.isInteger(t) ? String(t) : t.toFixed(2)}
                  </Typography>
                );
              },
            },
            {
              id: 'gst',
              header: 'Tax %',
              width: 72,
              align: 'right',
              render: (it) => <Typography variant="body2">{it.gstRate ?? 0}%</Typography>,
            },
          ]}
          onSelect={(item) => {
            const lid = itemPickerLineIdRef.current;
            if (!lid) return;
            const idx = linesRef.current.findIndex((l) => l.lineId === lid);
            if (idx < 0) {
              setItemPickerLineId(null);
              return;
            }
            updateLine(idx, { itemId: item.id });
            setItemPickerLineId(null);
            window.setTimeout(() => {
              focusRegistry.focusById(buildLineFieldId(lid, 'quantity'));
            }, 0);
          }}
          onCreateNew={() => {
            setItemPickerLineId(null);
            setShowQuickCreateItem(true);
          }}
          createNewLabel="+ Create New Item"
          emptyMessage="No items found."
        />
      </Stack>
    </Box>
  );
}

export default SalesVoucherForm;

interface SalesLineRowProps {
  line: ItemLineState;
  index: number;
  godowns: Godown[];
  updateLine: (index: number, patch: Partial<ItemLineState>) => void;
  removeLine: (index: number) => void;
  isLastRow: boolean;
  disableRemove: boolean;
  onRequestAddLine: () => void;
  onValidationError: (message: string | null) => void;
  requireGodown: boolean;
  getItemDisplayName: (itemId: string) => string;
  onOpenItemPicker: (rowIndex: number) => void;
}

const SalesLineRow = memo(
  ({
    line,
    index,
    godowns,
    updateLine,
    removeLine,
    isLastRow,
    disableRemove,
    onRequestAddLine,
    onValidationError,
    requireGodown,
    getItemDisplayName,
    onOpenItemPicker,
  }: SalesLineRowProps) => {
    const baseOrder = 100 + index * 10;

    const canAdvanceRow = useCallback(
      (l: ItemLineState) => isLineDataValid(l) && (!requireGodown || Boolean(l.godownId)),
      [requireGodown]
    );

    const ensureAdvance = useCallback(() => {
      if (!canAdvanceRow(line)) {
        onValidationError(
          requireGodown
            ? 'Complete item, quantity, rate, and godown before continuing.'
            : 'Complete the current line (item, quantity, rate) before continuing.'
        );
        return false;
      }
      onValidationError(null);
      if (isLastRow) {
        onRequestAddLine();
        return false;
      }
      return true;
    }, [canAdvanceRow, isLastRow, line, onRequestAddLine, onValidationError, requireGodown]);

    const itemFieldRef = useFocusField<HTMLInputElement>({
      screenId: SCREEN_ID,
      section: 'lines',
      order: baseOrder + 1,
      row: index,
      col: 1,
      id: buildLineFieldId(line.lineId, 'item'),
    });
    const quantityFieldRef = useFocusField<HTMLInputElement>({
      screenId: SCREEN_ID,
      section: 'lines',
      order: baseOrder + 2,
      row: index,
      col: 2,
      id: buildLineFieldId(line.lineId, 'quantity'),
      onBeforeNext: ensureAdvance,
    });
    const rateFieldRef = useFocusField<HTMLInputElement>({
      screenId: SCREEN_ID,
      section: 'lines',
      order: baseOrder + 3,
      row: index,
      col: 3,
    });
    const taxFieldRef = useFocusField<HTMLInputElement>({
      screenId: SCREEN_ID,
      section: 'lines',
      order: baseOrder + 4,
      row: index,
      col: 4,
    });
    const godownFieldRef = useFocusField<HTMLInputElement>({
      screenId: SCREEN_ID,
      section: 'lines',
      order: baseOrder + 5,
      row: index,
      col: 5,
      onBeforeNext: ensureAdvance,
    });

    return (
      <TableRow>
        <TableCell sx={{ minWidth: 200 }}>
          <TextField
            value={line.itemId ? getItemDisplayName(line.itemId) : ''}
            placeholder="Click to search items"
            fullWidth
            size="small"
            InputProps={{ readOnly: true }}
            inputRef={itemFieldRef}
            onClick={() => onOpenItemPicker(index)}
            inputProps={{ 'aria-haspopup': 'dialog' as const }}
          />
        </TableCell>
        <TableCell sx={{ minWidth: 100, width: 100 }}>
          <TextField
            type="number"
            value={line.quantity}
            onChange={(e) => updateLine(index, { quantity: e.target.value })}
            inputProps={{ min: 0, step: '0.01' }}
            inputRef={quantityFieldRef}
            fullWidth
          />
        </TableCell>
        <TableCell sx={{ minWidth: 280, width: 280 }}>
          <Stack spacing={1}>
            <TextField
              type="number"
              label="Rate (Excl. GST)"
              value={line.rateExclusive}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) {
                  updateLine(index, { rateExclusive: '', rateInclusive: '' });
                  return;
                }
                const exclusive = Number(value);
                const taxRate = Number(line.taxRate || 0);
                const inclusive = exclusive * (1 + taxRate / 100);
                updateLine(index, {
                  rateExclusive: value,
                  rateInclusive: Number.isFinite(inclusive) ? inclusive.toFixed(2) : '',
                });
              }}
              inputProps={{ min: 0, step: '0.01' }}
              inputRef={rateFieldRef}
              size="small"
              fullWidth
            />
            <TextField
              type="number"
              label="Rate (Incl. GST)"
              value={line.rateInclusive}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) {
                  updateLine(index, { rateInclusive: '', rateExclusive: '' });
                  return;
                }
                const inclusive = Number(value);
                const taxRate = Number(line.taxRate || 0);
                const exclusive = inclusive / (1 + taxRate / 100);
                updateLine(index, {
                  rateInclusive: value,
                  rateExclusive: Number.isFinite(exclusive) ? exclusive.toFixed(2) : '',
                });
              }}
              inputProps={{ min: 0, step: '0.01' }}
              size="small"
              fullWidth
            />
          </Stack>
        </TableCell>
        <TableCell sx={{ minWidth: 80, width: 80 }}>
          <TextField
            type="number"
            value={line.taxRate}
            onChange={(e) => updateLine(index, { taxRate: e.target.value })}
            inputProps={{ min: 0, step: '0.01' }}
            inputRef={taxFieldRef}
            fullWidth
            size="small"
          />
        </TableCell>
        <TableCell sx={{ minWidth: 180, width: 180 }}>
          <TextField
            select
            value={line.godownId}
            onChange={(e) => updateLine(index, { godownId: e.target.value })}
            fullWidth
            inputRef={godownFieldRef}
            SelectProps={{ displayEmpty: true }}
            size="small"
          >
            <MenuItem value="">
              <em>Select Godown</em>
            </MenuItem>
            {godowns.map((godown) => (
              <MenuItem key={godown.id} value={godown.id}>
                {godown.name}
              </MenuItem>
            ))}
          </TextField>
        </TableCell>
        <TableCell sx={{ minWidth: 120, width: 120 }} align="right">
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {computeLineAmount(line).toFixed(2)}
          </Typography>
        </TableCell>
        <TableCell sx={{ minWidth: 80, width: 80 }} align="right">
          <IconButton onClick={() => removeLine(index)} disabled={disableRemove}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>
    );
  }
);
