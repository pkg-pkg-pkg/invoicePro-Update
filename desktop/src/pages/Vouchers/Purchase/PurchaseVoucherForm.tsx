import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';

import { useActiveInventoryItems } from '../../../hooks/useActiveInventoryItems';
import { godownService } from '../../../services/masters/godownService';
import { partyService } from '../../../services/masters/partyService';
import { ledgerAccountService } from '../../../services/masters/ledgerAccountService';
import { voucherService } from '../../../services/vouchers/voucherService';
import { InventoryItem, Godown } from '../../../types/masters';
import { Party } from '../../../types/party';
import { usePermission } from '../../../hooks/usePermission';
import { autoLedgerService } from '../../../services/masters/autoLedgerService';
import { generateId } from '../../../utils/id';
import QuickCreateSupplierDialog from '../../../components/QuickCreateSupplierDialog';
import { PartyPickerModal } from '../../../components/parties/PartyPickerModal';
import { PartyPickerField } from '../../../components/parties/PartyPickerField';
import QuickCreateLedgerDialog from '../../../components/QuickCreateLedgerDialog';
import InventoryItemMasterDialog from '../../../components/InventoryItemMasterDialog';
import { ItemNotFoundDialog } from '../../../components/items/ItemNotFoundDialog';
import { ScanQuantityDialog } from '../../../components/items/ScanQuantityDialog';
import BarcodeScanner from '../../../components/scanner/BarcodeScanner';
import { VoucherScanButton } from '../../../components/Vouchers/VoucherScanButton';
import { VoucherScanToast } from '../../../components/Vouchers/VoucherScanToast';
import { useVoucherBarcodeScan } from '../../../hooks/useVoucherBarcodeScan';
import { decideGSTType } from '../../../services/vouchers/gstDecisionEngine';
import { bifurcateTax } from '../../../services/vouchers/gstBifurcationEngine';
import { normalizeStateToCode } from '../../../utils/stateMapping';
import { getNormalizedCompanyProfile } from '../../../utils/companyProfile';
import { rateMemory } from '../../../services/reports/rateMemory';
import { unitOfMeasureService } from '../../../services/masters/unitOfMeasureService';
import {
  applyDiscountAmountEdit,
  applyDiscountPercentEdit,
  applyExclusiveRateEdit,
  applyInclusiveRateEdit,
  applyTaxRateEdit,
  computeLineDiscountTotal,
  computeLineTaxableAmount,
  computeLineTaxAmount,
  discOnMrpPercent,
  isPricingLineValid,
  pricingToNumber as toNumber,
  rateInclusiveFromExclusive,
} from '../../../utils/voucherLinePricing';
import { usePincodeAutofill } from '../../../hooks/usePincodeAutofill';
import PincodeTextField from '../../../components/PincodeTextField';
import { erpContainedButtonSx } from '../../../theme/erpButtonStyles';
import {
  voucherLineCellSx,
  voucherLineNumericInputSx,
  voucherLinePercentInputSx,
  voucherLineTableContainerSx,
  voucherLineTableSx,
  voucherLineItemFieldSx,
  voucherLineSelectSx,
  voucherLineAmountDisplaySx,
} from '../../../theme/voucherLineItemTableStyles';

interface ItemLineState {
  lineId: string;
  itemId: string;
  quantity: string;
  mrp: string;
  rateExclusive: string;
  rateInclusive: string;
  discountPercent: string;
  discountAmount: string;
  taxRate: string;
  godownId: string;
}

const isLineDataValid = (line: ItemLineState) =>
  Boolean(line.itemId && isPricingLineValid(line) && line.godownId);

const computeLineAmount = (line: ItemLineState) => computeLineTaxableAmount(line);

const computeLineTax = (line: ItemLineState) => computeLineTaxAmount(line);

const PurchaseVoucherForm = () => {
  const navigate = useNavigate();
  const { id: editVoucherId } = useParams<{ id?: string }>();
  const { can } = usePermission();
  const canCreate = can('create-vouchers');
  const isEditMode = Boolean(editVoucherId);

  const {
    items: inventoryItems,
    setItems: setInventoryItems,
    reload: reloadInventoryItems,
  } = useActiveInventoryItems();
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuickCreateSupplier, setShowQuickCreateSupplier] = useState(false);
  const [showQuickCreatePurchase, setShowQuickCreatePurchase] = useState(false);
  const [showQuickCreateItem, setShowQuickCreateItem] = useState(false);
  const [showBarcodeNotFound, setShowBarcodeNotFound] = useState(false);
  const [pendingScannedBarcode, setPendingScannedBarcode] = useState('');
  const [supplierConfirmOpen, setSupplierConfirmOpen] = useState(false);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [pendingSupplierDetails, setPendingSupplierDetails] = useState<Partial<Party> | null>(null);
  const supplierPinAutofill = usePincodeAutofill({
    onFilled: useCallback((addr) => {
      setPendingSupplierDetails((prev) => ({
        ...(prev || {}),
        city: addr.city,
        district: addr.district,
        state: addr.state,
      }));
    }, []),
  });
  const [companyState, setCompanyState] = useState<string>('');
  const [supplierState, setSupplierState] = useState<string>('');
  const [enableRoundOff, setEnableRoundOff] = useState(true);
  const lineItemsSectionRef = useRef<HTMLDivElement | null>(null);

  const createLine = (godownId: string): ItemLineState => ({
    lineId: generateId('p-line'),
    itemId: '',
    quantity: '',
    mrp: '',
    rateExclusive: '',
    rateInclusive: '',
    discountPercent: '',
    discountAmount: '',
    taxRate: '0',
    godownId,
  });

  const [lines, setLines] = useState<ItemLineState[]>([createLine('')]);
  const [unitLabelById, setUnitLabelById] = useState<Map<string, string>>(new Map());
  const editLoadedRef = useRef<string | null>(null);

  const [formState, setFormState] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    number: `PUR-${dayjs().format('YYYYMMDD-HHmmss')}`,
    partyId: '',
    supplierName: '', // Keep for backward compatibility
    supplierGstin: '',
    supplierInvoiceNumber: '',
    supplierInvoiceDate: '',
    defaultGodownId: '',
    narration: '',
    purchaseLedgerId: '',
    termsAndConditions: '',
    notes: '',
  });

  const parseNarrationToken = useCallback((narration: string, key: string): string => {
    const token = narration.match(new RegExp(`${key}\\[([^\\]]+)\\]`));
    return String(token?.[1] || '').trim();
  }, []);

  useEffect(() => {
    const rawState = getNormalizedCompanyProfile().state || '';
    if (rawState) {
      setCompanyState(normalizeStateToCode(rawState));
    }

    // Load parties for purchase (SUPPLIER + BOTH types)
    partyService
      .listForPurchase()
      .then(setParties)
      .catch(() => setParties([]));


    godownService
      .list({ includeInactive: false })
      .then((list) => {
        const active = list.filter((godown) => godown.isActive !== false);
        // If multiple godowns exist, force user selection line-wise.
        // Auto-select only when exactly one godown is available.
        const preferred = active.length === 1 ? active[0] : null;
        setGodowns(active);
        setFormState((prev) => {
          const nextDefaultGodownId = preferred?.id ?? '';
          if (prev.defaultGodownId === nextDefaultGodownId) return prev;
          return { ...prev, defaultGodownId: nextDefaultGodownId };
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
  }, []);

  useEffect(() => {
    void unitOfMeasureService.list().then((units) => {
      setUnitLabelById(new Map(units.map((u) => [u.id, u.name || u.symbol || u.id])));
    });
  }, []);

  useEffect(() => {
    if (!formState.defaultGodownId) return;
    setLines((prev) =>
      prev.map((line) => (line.godownId ? line : { ...line, godownId: formState.defaultGodownId }))
    );
  }, [formState.defaultGodownId]);

  useEffect(() => {
    if (!editVoucherId) return;
    if (editLoadedRef.current === editVoucherId) return;
    if (!parties.length || !inventoryItems.length) return;
    let mounted = true;
    const loadForEdit = async () => {
      try {
        const voucher = await voucherService.getById(editVoucherId);
        if (!mounted) return;
        if (!voucher || voucher.type !== 'PURCHASE') {
          setError('Purchase voucher not found for edit.');
          return;
        }
        const supplierLine = voucher.lines.find((line) => (line.credit ?? 0) > 0);
        const supplierLedger = String(supplierLine?.ledgerId || '');
        let linkedParty = parties.find((p) => p.ledgerId === supplierLedger) || null;
        if (!linkedParty && supplierLedger) {
          const ledger = await ledgerAccountService.getById(supplierLedger);
          if (ledger) {
            const tempParty: Party = {
              id: `temp-${ledger.id}`,
              name: ledger.name || 'Supplier',
              type: 'SUPPLIER' as any,
              ledgerId: ledger.id,
              gstin: ledger.gstDetails?.gstin || '',
              mobile: ledger.contactDetails?.phone || '',
              email: ledger.contactDetails?.email || '',
              address: ledger.contactDetails?.address || '',
              city: '',
              state: '',
              pincode: '',
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as any;
            linkedParty = tempParty;
            setParties((prev) => {
              if (prev.some((p) => p.id === tempParty.id)) return prev;
              return [...prev, tempParty];
            });
          }
        }
        const itemLines = voucher.lines.filter((line) => line.itemId && Number(line.quantity || 0) > 0);
        const mappedLines =
          itemLines.length > 0
            ? itemLines.map((line) => {
                const qty = Number(line.quantity || 0);
                const amount = Number(line.debit || line.credit || 0);
                const rate = qty > 0 ? Number((amount / qty).toFixed(2)) : 0;
                const inv = inventoryItems.find((it) => it.id === String(line.itemId));
                const gst = Number(inv?.gstRate ?? 0);
                return {
                  lineId: generateId('p-line'),
                  itemId: String(line.itemId || ''),
                  quantity: String(qty || ''),
                  mrp: inv?.pricing?.mrp ? String(inv.pricing.mrp) : '',
                  rateExclusive: String(rate || ''),
                  rateInclusive: gst ? String((rate * (1 + gst / 100)).toFixed(2)) : String(rate || ''),
                  discountPercent: '',
                  discountAmount: '',
                  taxRate: String(gst),
                  godownId: String(line.godownId || formState.defaultGodownId || ''),
                } as ItemLineState;
              })
            : [createLine(formState.defaultGodownId)];
        setLines(mappedLines);
        const rawNarration = String(voucher.narration || '');
        setFormState((prev) => ({
          ...prev,
          date: dayjs(voucher.date).format('YYYY-MM-DD'),
          number: voucher.number,
          narration: rawNarration.replace(/SUPPINV\[[^\]]*\]/g, '').replace(/SUPPDATE\[[^\]]*\]/g, '').trim(),
          supplierInvoiceNumber: parseNarrationToken(rawNarration, 'SUPPINV'),
          supplierInvoiceDate: parseNarrationToken(rawNarration, 'SUPPDATE'),
          partyId: linkedParty?.id || prev.partyId,
          supplierName: linkedParty?.name || prev.supplierName,
          supplierGstin: linkedParty?.gstin || prev.supplierGstin,
        }));
        editLoadedRef.current = editVoucherId;
      } catch (e) {
        if (!mounted) return;
        setError((e as Error).message || 'Failed to load voucher for edit.');
      }
    };
    void loadForEdit();
    return () => {
      mounted = false;
    };
  }, [editVoucherId, parties, inventoryItems, formState.defaultGodownId, parseNarrationToken]);

  const itemMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventoryItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [inventoryItems]);

  const supplierLedgerId = useMemo(
    () => parties.find((p) => p.id === formState.partyId)?.ledgerId ?? '',
    [parties, formState.partyId]
  );
  const selectedSupplierAddress = useMemo(
    () => String(parties.find((p) => p.id === formState.partyId)?.address || '').trim(),
    [parties, formState.partyId]
  );

  const updateLine = useCallback(
    (index: number, patch: Partial<ItemLineState>) => {
      setLines((prev) =>
        prev.map((line, idx) => {
          if (idx !== index) return line;
          let next = { ...line, ...patch };
          if (patch.itemId) {
            const selectedItem = itemMap.get(patch.itemId);
            const mem = rateMemory.getLastPurchaseExclusive(supplierLedgerId, patch.itemId);
            const basePur = Number(selectedItem?.pricing?.purchase ?? 0);
            const rateEx = mem ?? (Number.isFinite(basePur) ? basePur : 0);
            const gst = Number(selectedItem?.gstRate ?? 0);
            const mrp = Number(selectedItem?.pricing?.mrp ?? 0);
            if (rateEx > 0) {
              next.rateExclusive = String(rateEx);
              next.rateInclusive = String(rateInclusiveFromExclusive(rateEx, gst));
            }
            if (selectedItem && selectedItem.gstRate != null) {
              next.taxRate = String(selectedItem.gstRate);
            }
            next.mrp = mrp > 0 ? String(mrp) : '';
            next.discountPercent = '';
            next.discountAmount = '';
          }
          if (patch.rateExclusive !== undefined && next.discountPercent) {
            next = { ...next, ...applyDiscountPercentEdit(next.discountPercent, next.rateExclusive) };
          }
          return next;
        })
      );
    },
    [itemMap, supplierLedgerId]
  );

  const wedgeBlocked = useCallback(
    () => showQuickCreateSupplier || showQuickCreatePurchase || showQuickCreateItem || showBarcodeNotFound,
    [showQuickCreateSupplier, showQuickCreatePurchase, showQuickCreateItem, showBarcodeNotFound]
  );

  const {
    scannerOpen,
    setScannerOpen,
    highlightLineId,
    toast: scanToast,
    placeItem: placeItemFromScan,
    handleScannedBarcode,
    qtyPromptItem,
    confirmQtyPrompt,
    cancelQtyPrompt,
  } = useVoucherBarcodeScan<ItemLineState>({
    inventoryItems,
    lines,
    setLines,
    mode: 'purchase',
    getRate: (item) => Number(item.pricing?.purchase ?? 0),
    buildLineFromItem: (item, template) => {
      const mem =
        supplierLedgerId && item.id ? rateMemory.getLastPurchaseExclusive(supplierLedgerId, item.id) : null;
      const basePur = Number(item.pricing?.purchase ?? 0);
      const rateEx = mem ?? (Number.isFinite(basePur) ? basePur : 0);
      const gst = Number(item.gstRate ?? 0);
      const mrp = Number(item.pricing?.mrp ?? 0);
      return {
        ...template,
        itemId: item.id,
        mrp: mrp > 0 ? String(mrp) : '',
        rateExclusive: rateEx > 0 ? String(rateEx) : template.rateExclusive,
        rateInclusive:
          rateEx > 0 ? String(rateInclusiveFromExclusive(rateEx, gst)) : template.rateInclusive,
        taxRate: String(gst),
        discountPercent: '',
        discountAmount: '',
        quantity: template.quantity && Number(template.quantity) > 0 ? template.quantity : '1',
      };
    },
    createEmptyLine: () => createLine(formState.defaultGodownId),
    isLineValid: isLineDataValid,
    wedgeBlocked,
    onNotFound: (barcode) => {
      setPendingScannedBarcode(barcode);
      setShowBarcodeNotFound(true);
    },
  });

  const addLine = () => setLines((prev) => [...prev, createLine(formState.defaultGodownId)]);

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + computeLineAmount(line), 0);
    const discountTotal = lines.reduce((sum, line) => sum + computeLineDiscountTotal(line), 0);
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
      ? lines.reduce((sum, line) => sum + (Number(line.taxRate) || 0), 0) / lines.length
      : 0;
    
    // Bifurcate tax
    const taxBifurcated = bifurcateTax(taxTotal, avgGstRate, gstDecision.taxType);

    return {
      subtotal: Number(subtotal.toFixed(2)),
      discountTotal: Number(discountTotal.toFixed(2)),
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
    (isEditMode || selectedSupplierAddress.length > 0) &&
    lines.some(isLineDataValid) &&
    !saving;

  const handleInventoryMasterSaved = (newItem: InventoryItem) => {
    setInventoryItems((prev) => {
      if (prev.some((item) => item.id === newItem.id)) return prev;
      return [...prev, newItem];
    });
    placeItemFromScan(newItem);
    setPendingScannedBarcode('');
    setShowQuickCreateItem(false);
    void reloadInventoryItems();
  };

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
    const purchaseLedger = await ledgerAccountService.getById(purchaseLedgerId);
    const resolvedPurchaseLedger =
      !purchaseLedger || purchaseLedger.isActive === false
        ? (await autoLedgerService.ensureCore()).purchaseLedgerId
        : purchaseLedgerId;
    const cgstInputLedger = await ledgerAccountService.getById(cgstInputLedgerId);
    const resolvedCgstInputLedger =
      !cgstInputLedger || cgstInputLedger.isActive === false
        ? (await autoLedgerService.ensureGSTInputLedgers()).cgstInputLedgerId
        : cgstInputLedgerId;
    const sgstInputLedger = await ledgerAccountService.getById(sgstInputLedgerId);
    const resolvedSgstInputLedger =
      !sgstInputLedger || sgstInputLedger.isActive === false
        ? (await autoLedgerService.ensureGSTInputLedgers()).sgstInputLedgerId
        : sgstInputLedgerId;
    const igstInputLedger = await ledgerAccountService.getById(igstInputLedgerId);
    const resolvedIgstInputLedger =
      !igstInputLedger || igstInputLedger.isActive === false
        ? (await autoLedgerService.ensureGSTInputLedgers()).igstInputLedgerId
        : igstInputLedgerId;
    
    const voucherLines: any[] = [];
    const validItemLines = lines
      .filter((line) => line.itemId && Number(line.quantity) > 0)
      .map((line) => ({
        itemId: String(line.itemId),
        quantity: Number(line.quantity),
        amount: computeLineAmount(line),
        godownId: line.godownId || '',
      }))
      .filter((line) => line.amount > 0);
    if (!validItemLines.length) {
      throw new Error('Please add at least one valid inventory item with quantity.');
    }
    
    // 1. Debit Purchase per item (preserves stock impact metadata)
    validItemLines.forEach((line) => {
      voucherLines.push({
        ledgerId: resolvedPurchaseLedger,
        debit: line.amount,
        credit: 0,
        itemId: line.itemId,
        quantity: line.quantity,
        godownId: line.godownId,
      });
    });
    
    // 2. Debit GST Input (bifurcated)
    if (totals.itemTax > 0) {
      if (totals.gstDecision.isLocalTransaction) {
        if (totals.taxBifurcated.cgst > 0) {
          voucherLines.push({
            ledgerId: resolvedCgstInputLedger,
            debit: totals.taxBifurcated.cgst,
            credit: 0,
            taxType: 'CGST_SGST',
          });
        }
        if (totals.taxBifurcated.sgst > 0) {
          voucherLines.push({
            ledgerId: resolvedSgstInputLedger,
            debit: totals.taxBifurcated.sgst,
            credit: 0,
            taxType: 'CGST_SGST',
          });
        }
      } else {
        if (totals.taxBifurcated.igst > 0) {
          voucherLines.push({
            ledgerId: resolvedIgstInputLedger,
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
    
    // Normalize precision and reconcile tiny rounding drift so posting engine never fails on strict equality.
    const normalizedLines = voucherLines.map((line) => ({
      ...line,
      debit: Number(Number(line.debit || 0).toFixed(2)),
      credit: Number(Number(line.credit || 0).toFixed(2)),
    }));
    const totalDebit = Number(normalizedLines.reduce((sum, line) => sum + Number(line.debit || 0), 0).toFixed(2));
    const totalCredit = Number(normalizedLines.reduce((sum, line) => sum + Number(line.credit || 0), 0).toFixed(2));
    const drift = Number((totalDebit - totalCredit).toFixed(2));
    if (drift !== 0) {
      const roundOffLedgerId = await autoLedgerService.ensureRoundOffLedger();
      if (drift > 0) {
        normalizedLines.push({ ledgerId: roundOffLedgerId, debit: 0, credit: drift });
      } else {
        normalizedLines.push({ ledgerId: roundOffLedgerId, debit: Math.abs(drift), credit: 0 });
      }
    }
    return normalizedLines;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isEditMode && !selectedSupplierAddress) {
      setError('Supplier address is required.');
      return;
    }
    if (!canSubmit) {
      setError('Please complete all required fields before saving.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const voucherLines = await buildVoucherLines();
      const extraTokens = [
        formState.supplierInvoiceNumber ? `SUPPINV[${String(formState.supplierInvoiceNumber).trim()}]` : '',
        formState.supplierInvoiceDate ? `SUPPDATE[${String(formState.supplierInvoiceDate).trim()}]` : '',
      ].filter(Boolean);
      const narrationWithSupplierInvoice = `${String(formState.narration || '').trim()} ${extraTokens.join(' ')}`.trim();
      if (isEditMode && editVoucherId) {
        await voucherService.update(editVoucherId, {
          type: 'PURCHASE',
          date: new Date(formState.date).toISOString(),
          number: formState.number,
          narration: narrationWithSupplierInvoice,
          lines: voucherLines,
        });
      } else {
        await voucherService.create({
          type: 'PURCHASE',
          date: new Date(formState.date).toISOString(),
          number: formState.number,
          narration: narrationWithSupplierInvoice,
          lines: voucherLines,
        });
      }
      const supplierLedgerId = parties.find((p) => p.id === formState.partyId)?.ledgerId ?? '';
      if (supplierLedgerId) {
        for (const line of lines) {
          const r = Number(line.rateExclusive) || 0;
          if (line.itemId && r > 0) {
            rateMemory.setLastPurchaseExclusive(supplierLedgerId, line.itemId, r);
          }
        }
      }
      navigate('/vouchers/purchase');
    } catch (err) {
      setError((err as Error).message ?? (isEditMode ? 'Failed to update voucher' : 'Failed to create voucher'));
    } finally {
      setSaving(false);
    }
  };

  const applyConfirmedSupplier = useCallback(async () => {
    const selected = pendingSupplierDetails;
    if (!selected?.id) {
      setSupplierConfirmOpen(false);
      setPendingSupplierDetails(null);
      return;
    }
    if (!String(selected.address || '').trim()) {
      return;
    }
    if (selected.id) {
      try {
        const updated = await partyService.update(String(selected.id), {
          name: String(selected.name || ''),
          mobile: String(selected.mobile || ''),
          gstin: String(selected.gstin || ''),
          address: String(selected.address || ''),
          state: String(selected.state || ''),
          pincode: String(selected.pincode || ''),
          email: String(selected.email || ''),
          city: String(selected.city || ''),
          district: String(selected.district || ''),
        });
        setParties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } catch (e) {
        setError((e as Error).message || 'Failed to save supplier details.');
        return;
      }
    }
    setFormState((prev) => ({
      ...prev,
      partyId: String(selected.id),
      supplierName: String(selected.name || ''),
      supplierGstin: String(selected.gstin || ''),
    }));
    setParties((prev) =>
      prev.map((p) =>
        p.id === String(selected.id)
          ? {
              ...p,
              name: String(selected.name || p.name || ''),
              gstin: String(selected.gstin || p.gstin || ''),
              mobile: String(selected.mobile || p.mobile || ''),
              city: String(selected.city || p.city || ''),
              state: String(selected.state || p.state || ''),
              pincode: String(selected.pincode || p.pincode || ''),
              address: String(selected.address || p.address || ''),
            }
          : p
      )
    );
    if (selected.gstin && selected.gstin.length >= 2) {
      setSupplierState(selected.gstin.substring(0, 2));
    } else if (selected.state) {
      setSupplierState(selected.state);
    } else {
      setSupplierState('');
    }
    setSupplierConfirmOpen(false);
    setPendingSupplierDetails(null);
    window.setTimeout(() => {
      const target = lineItemsSectionRef.current;
      const scroller = target?.closest('[data-erp-dense]') as HTMLElement | null;
      if (target && scroller) {
        const targetRect = target.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const top = scroller.scrollTop + (targetRect.top - scrollerRect.top) - 8;
        scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      } else {
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }, [pendingSupplierDetails]);

  return (
    <Card component="form" onSubmit={handleSubmit}>
      <CardContent sx={{ py: 1.25, px: 1.5, '&:last-child': { pb: 1.25 } }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="h5" fontWeight={600}>
                New Purchase Voucher
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Record purchases with automatic GST bifurcation ({totals.gstDecision.isLocalTransaction ? 'CGST + SGST' : 'IGST'}).
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} flexWrap="wrap" justifyContent="flex-end" sx={{ width: { xs: '100%', sm: 'auto' } }}>
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

          <Grid container spacing={1.25}>
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
                    <Grid item xs={12} md={2}>
                      <TextField
                        label="Supplier Invoice No."
                        value={formState.supplierInvoiceNumber}
                        onChange={(e) => setFormState((prev) => ({ ...prev, supplierInvoiceNumber: e.target.value }))}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        label="Supplier Invoice Date"
                        type="date"
                        value={formState.supplierInvoiceDate}
                        onChange={(e) => setFormState((prev) => ({ ...prev, supplierInvoiceDate: e.target.value }))}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Stack direction="row" spacing={1}>
                        <PartyPickerField
                          label="Creditor"
                          displayValue={
                            parties.find((p) => p.id === formState.partyId)?.name ?? formState.supplierName
                          }
                          placeholder="Select creditor"
                          required
                          onOpen={() => setSupplierPickerOpen(true)}
                        />
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
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                Total Voucher Value: ₹ {totals.grandTotal.toFixed(2)}
              </Typography>
            </Grid>
          </Grid>

          <Stack spacing={2} ref={lineItemsSectionRef}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight={600}>
                Inventory Items
              </Typography>
              <Stack direction="row" spacing={1}>
                <VoucherScanButton onClick={() => setScannerOpen(true)} />
                <Button variant="text" onClick={() => setShowQuickCreateItem(true)}>
                  + New Item
                </Button>
                <Button variant="text" startIcon={<AddIcon />} onClick={addLine}>
                  Add Item
                </Button>
              </Stack>
            </Stack>
            <Box sx={voucherLineTableContainerSx}>
            <Table size="small" sx={voucherLineTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={voucherLineCellSx('index')}>#</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>Item</TableCell>
                  <TableCell sx={voucherLineCellSx('qty')} align="right">Qty</TableCell>
                  <TableCell sx={voucherLineCellSx('unit')}>Unit</TableCell>
                  <TableCell sx={voucherLineCellSx('mrp')} align="right">MRP</TableCell>
                  <TableCell sx={voucherLineCellSx('rate')} align="right">Rate (Excl. GST)</TableCell>
                  <TableCell sx={voucherLineCellSx('rate')} align="right">Rate (Incl. GST)</TableCell>
                  <TableCell sx={voucherLineCellSx('discPercent')} align="right">Disc %</TableCell>
                  <TableCell sx={voucherLineCellSx('discAmount')} align="right">Disc Amt</TableCell>
                  <TableCell sx={voucherLineCellSx('gstPercent')} align="right">GST %</TableCell>
                  <TableCell sx={voucherLineCellSx('amount')} align="right">Amount</TableCell>
                  <TableCell sx={voucherLineCellSx('godown')}>Godown</TableCell>
                  <TableCell sx={voucherLineCellSx('delete')} align="right">Delete</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((line, index) => {
                  const mrpVal = toNumber(line.mrp);
                  const rateEx = toNumber(line.rateExclusive);
                  const mrpDisc = discOnMrpPercent(mrpVal, rateEx);
                  const unitLabel = line.itemId
                    ? unitLabelById.get(itemMap.get(line.itemId)?.unitId ?? '') ??
                      itemMap.get(line.itemId)?.unitId ??
                      '—'
                    : '—';
                  return (
                  <TableRow
                    key={`line-${line.lineId}`}
                    sx={
                      highlightLineId === line.lineId
                        ? {
                            animation: 'scanFlash 1s ease',
                            '@keyframes scanFlash': {
                              '0%': { bgcolor: 'rgba(76, 175, 80, 0.35)' },
                              '100%': { bgcolor: 'transparent' },
                            },
                          }
                        : undefined
                    }
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
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
                    <TableCell sx={voucherLineCellSx('qty')} align="right">
                      <TextField
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: e.target.value })}
                        inputProps={{ min: 0, step: '0.01' }}
                        size="small"
                        fullWidth
                        sx={voucherLinePercentInputSx}
                      />
                    </TableCell>
                    <TableCell sx={voucherLineCellSx('unit')}>
                      <Typography variant="body2" color="text.secondary">{unitLabel}</Typography>
                    </TableCell>
                    <TableCell sx={voucherLineCellSx('mrp')} align="right">
                      <Stack spacing={0.25}>
                        <TextField
                          type="number"
                          value={line.mrp}
                          onChange={(e) => updateLine(index, { mrp: e.target.value })}
                          inputProps={{ min: 0, step: '0.01' }}
                          size="small"
                          fullWidth
                          sx={voucherLineNumericInputSx}
                        />
                        {mrpDisc != null ? (
                          <Typography variant="caption" color="success.main">
                            Disc on MRP: {mrpDisc.toFixed(2)}%
                          </Typography>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell sx={voucherLineCellSx('rate')} align="right">
                      <TextField
                        type="number"
                        value={line.rateExclusive}
                        onChange={(e) =>
                          updateLine(index, applyExclusiveRateEdit(e.target.value, line.taxRate))
                        }
                        inputProps={{ min: 0, step: '0.01' }}
                        size="small"
                        fullWidth
                        sx={voucherLineNumericInputSx}
                      />
                    </TableCell>
                    <TableCell sx={voucherLineCellSx('rate')} align="right">
                      <TextField
                        type="number"
                        value={line.rateInclusive}
                        onChange={(e) =>
                          updateLine(index, applyInclusiveRateEdit(e.target.value, line.taxRate))
                        }
                        inputProps={{ min: 0, step: '0.01' }}
                        size="small"
                        fullWidth
                        sx={voucherLineNumericInputSx}
                      />
                    </TableCell>
                    <TableCell sx={voucherLineCellSx('discPercent')} align="right">
                      <TextField
                        type="number"
                        value={line.discountPercent}
                        onChange={(e) =>
                          updateLine(index, applyDiscountPercentEdit(e.target.value, line.rateExclusive))
                        }
                        inputProps={{ min: 0, max: 100, step: '0.01' }}
                        size="small"
                        fullWidth
                        sx={voucherLinePercentInputSx}
                      />
                    </TableCell>
                    <TableCell sx={voucherLineCellSx('discAmount')} align="right">
                      <TextField
                        type="number"
                        value={line.discountAmount}
                        onChange={(e) =>
                          updateLine(index, applyDiscountAmountEdit(e.target.value, line.rateExclusive))
                        }
                        inputProps={{ min: 0, step: '0.01' }}
                        size="small"
                        fullWidth
                        sx={voucherLineNumericInputSx}
                      />
                    </TableCell>
                    <TableCell sx={voucherLineCellSx('gstPercent')} align="right">
                      <TextField
                        type="number"
                        value={line.taxRate}
                        onChange={(e) =>
                          updateLine(
                            index,
                            applyTaxRateEdit(e.target.value, line.rateExclusive, line.rateInclusive, 'exclusive')
                          )
                        }
                        inputProps={{ min: 0, max: 28, step: '0.01' }}
                        size="small"
                        fullWidth
                        sx={voucherLinePercentInputSx}
                      />
                    </TableCell>
                    <TableCell sx={voucherLineCellSx('amount')} align="right">
                      <Typography component="span" sx={voucherLineAmountDisplaySx}>
                        {computeLineAmount(line).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={voucherLineCellSx('godown')}>
                      <Select
                        displayEmpty
                        value={line.godownId}
                        onChange={(e) => updateLine(index, { godownId: e.target.value })}
                        fullWidth
                        size="small"
                        sx={voucherLineSelectSx}
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
                    <TableCell sx={{ minWidth: 56, width: 56 }} align="right">
                      <IconButton onClick={() => removeLine(index)} disabled={lines.length === 1}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  );
                })}
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
                    {totals.discountTotal > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Total Discount:</Typography>
                        <Typography variant="body2" fontWeight={600}>₹ {totals.discountTotal.toFixed(2)}</Typography>
                      </Stack>
                    )}
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

        <PartyPickerModal
          open={supplierPickerOpen}
          onClose={() => setSupplierPickerOpen(false)}
          scope="creditor"
          title="Select Creditor"
          onSelect={(ledger) => {
            setSupplierPickerOpen(false);
            const selectedParty = parties.find((p) => p.ledgerId === ledger.id);
            if (selectedParty) {
              setPendingSupplierDetails(selectedParty);
              window.setTimeout(() => setSupplierConfirmOpen(true), 80);
            }
          }}
          onCreateNew={() => {
            setSupplierPickerOpen(false);
            setShowQuickCreateSupplier(true);
          }}
          createNewLabel="+ Create New Creditor"
        />

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

        <ItemNotFoundDialog
          open={showBarcodeNotFound}
          barcode={pendingScannedBarcode}
          onCancel={() => {
            setShowBarcodeNotFound(false);
            setPendingScannedBarcode('');
          }}
          onConfirm={() => {
            setShowBarcodeNotFound(false);
            setShowQuickCreateItem(true);
          }}
        />

        <ScanQuantityDialog
          open={Boolean(qtyPromptItem)}
          itemName={qtyPromptItem?.name ?? ''}
          onConfirm={confirmQtyPrompt}
          onCancel={cancelQtyPrompt}
        />

        <InventoryItemMasterDialog
          open={showQuickCreateItem}
          initialBarcode={pendingScannedBarcode}
          onClose={() => {
            setShowQuickCreateItem(false);
            setPendingScannedBarcode('');
          }}
          onSaved={handleInventoryMasterSaved}
        />

        <BarcodeScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={(code) => {
            setError(null);
            handleScannedBarcode(code);
          }}
        />
        <VoucherScanToast toast={scanToast} />

        <Dialog
          open={supplierConfirmOpen}
          onClose={() => {
            setSupplierConfirmOpen(false);
            setPendingSupplierDetails(null);
          }}
          maxWidth="sm"
          fullWidth
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setSupplierConfirmOpen(false);
              setPendingSupplierDetails(null);
              return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
              e.preventDefault();
              applyConfirmedSupplier();
            }
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>Confirm Supplier Details</DialogTitle>
          <DialogContent sx={{ pt: '8px !important' }}>
            <Stack spacing={1.25}>
              <Typography variant="body2" color="text.secondary">
                Supplier details verify karo. Accept karte hi purchase entry continue hogi.
              </Typography>
              <TextField
                label="Supplier Name"
                size="small"
                value={pendingSupplierDetails?.name || ''}
                onChange={(e) =>
                  setPendingSupplierDetails((prev) => ({ ...(prev || {}), name: e.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Address"
                size="small"
                value={pendingSupplierDetails?.address || ''}
                onChange={(e) =>
                  setPendingSupplierDetails((prev) => ({ ...(prev || {}), address: e.target.value }))
                }
                required
                error={!String(pendingSupplierDetails?.address || '').trim()}
                helperText={!String(pendingSupplierDetails?.address || '').trim() ? 'Address is mandatory' : ''}
                fullWidth
              />
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="GSTIN"
                    size="small"
                    value={pendingSupplierDetails?.gstin || ''}
                    onChange={(e) =>
                      setPendingSupplierDetails((prev) => ({ ...(prev || {}), gstin: e.target.value }))
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Phone"
                    size="small"
                    value={pendingSupplierDetails?.mobile || ''}
                    onChange={(e) =>
                      setPendingSupplierDetails((prev) => ({ ...(prev || {}), mobile: e.target.value }))
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <PincodeTextField
                    label="Pincode"
                    size="small"
                    value={pendingSupplierDetails?.pincode || ''}
                    onPinChange={(pincode) =>
                      setPendingSupplierDetails((prev) => ({ ...(prev || {}), pincode }))
                    }
                    autofill={supplierPinAutofill}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="City"
                    size="small"
                    value={pendingSupplierDetails?.city || ''}
                    onChange={(e) => {
                      supplierPinAutofill.clearHighlight('city');
                      setPendingSupplierDetails((prev) => ({ ...(prev || {}), city: e.target.value }));
                    }}
                    sx={supplierPinAutofill.fieldSx('city')}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="District"
                    size="small"
                    value={pendingSupplierDetails?.district || ''}
                    onChange={(e) => {
                      supplierPinAutofill.clearHighlight('district');
                      setPendingSupplierDetails((prev) => ({ ...(prev || {}), district: e.target.value }));
                    }}
                    sx={supplierPinAutofill.fieldSx('district')}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="State"
                    size="small"
                    value={pendingSupplierDetails?.state || ''}
                    onChange={(e) => {
                      supplierPinAutofill.clearHighlight('state');
                      setPendingSupplierDetails((prev) => ({ ...(prev || {}), state: e.target.value }));
                    }}
                    sx={supplierPinAutofill.fieldSx('state')}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => {
                setSupplierConfirmOpen(false);
                setPendingSupplierDetails(null);
              }}
            >
              Cancel (Esc)
            </Button>
            <Button
              variant="contained"
              onClick={applyConfirmedSupplier}
              disabled={!String(pendingSupplierDetails?.address || '').trim()}
              sx={erpContainedButtonSx}
            >
              Accept & Continue (Ctrl+A)
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </CardContent>
  </Card>
  );
};

export default PurchaseVoucherForm;

