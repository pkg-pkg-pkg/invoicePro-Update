import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
  Chip,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import dayjs from 'dayjs';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ledgerAccountService } from '../../../services/masters/ledgerAccountService';
import { partyService } from '../../../services/masters/partyService';
import { useActiveInventoryItems } from '../../../hooks/useActiveInventoryItems';
import { godownService } from '../../../services/masters/godownService';
import { unitOfMeasureService } from '../../../services/masters/unitOfMeasureService';
import { voucherService } from '../../../services/vouchers/voucherService';
import { peekNextInvoiceNumber } from '../../../services/vouchers/invoiceNumberService';
import { LedgerAccount, InventoryItem, Godown, PriceList } from '../../../types/masters';
import { Party } from '../../../types/party';
import { usePermission } from '../../../hooks/usePermission';
import { focusRegistry } from '../../../services/focus/focusRegistry';
import { useFocusField } from '../../../hooks/useFocusField';
import { generateId } from '../../../utils/id';
import InvoiceHeader from './components/InvoiceHeader';
import PartyCards, { PartyInfo } from './components/PartyCards';
import { erpContainedButtonSx } from '../../../theme/erpButtonStyles';
import { usePincodeAutofill } from '../../../hooks/usePincodeAutofill';
import PincodeTextField from '../../../components/PincodeTextField';
import ActionFooter from './components/ActionFooter';
import AdditionalCharges, { AdditionalChargeState } from './components/AdditionalCharges';
import { decideGSTType } from '../../../services/vouchers/gstDecisionEngine';
import { bifurcateTax } from '../../../services/vouchers/gstBifurcationEngine';
import { buildSalesVoucherLinesWithGST } from '../../../services/vouchers/salesVoucherGSTBuilder';
import { getAppSettings } from '../../../services/appSettingsService';
import { autoLedgerService } from '../../../services/masters/autoLedgerService';
import QuickCreateLedgerDialog from '../../../components/QuickCreateLedgerDialog';
import PartyMasterDialog from '../../../components/PartyMasterDialog';
import InventoryItemMasterDialog from '../../../components/InventoryItemMasterDialog';
import { ListPickerModal } from './components/ListPickerModal';
import { rateMemory } from '../../../services/reports/rateMemory';
import { priceListService } from '../../../services/masters/priceListService';
import { partyProfileService } from '../../../services/masters/partyProfileService';
import { getNormalizedCompanyProfile } from '../../../utils/companyProfile';
import schemeService, { Scheme } from '../../../services/schemeService';
import { calculateFinalQuantity, getBestScheme } from '../../../services/schemeResolutionEngine';
import { buildInvoiceHTML, PrintFormat } from '../../../services/printService';
import { getInvoicePrintLayout, getInvoiceTemplateId } from '../../../services/companySettingsService';
import type { InvoiceTemplateId } from '../../../templates/invoice/invoiceTemplatesConfig';
import PrintExportSetupDialog, {
  type PrintExportAction,
  type PrintExportBuildInput,
} from '../../../components/invoice/PrintExportSetupDialog';
import { resolvePrintFormatFromLayout } from '../../../services/voucherPrintBuilder';
import { runInvoicePrintExportAction } from '../../../services/invoicePrintFlow';
import { salesPipelineService } from '../../../services/sales/salesDocumentService';
import { PIPELINE_PREFILL_KEY } from '../../../components/listActions/documentRowActionsHandlers';
import { EwayBillThresholdDialog } from '../../../components/eway/EwayBillThresholdDialog';
import { EwayBillDetailsModal } from '../../../components/eway/EwayBillDetailsModal';
import { EwayBillInfoPanel } from '../../../components/eway/EwayBillInfoPanel';
import type { EwayBillFormValues, VoucherEwayBill } from '../../../types/ewayBill';
import {
  buildEwayBillForSkipSave,
  buildEwayPrintBlock,
  buildEwayPrintDocumentHtml,
  ewayBillToFormValues,
  formValuesToEwayBill,
  patchVoucherEwayBill,
  shouldShowEwayReminder,
} from '../../../services/ewayBillService';

interface ItemLineState {
  lineId: string;
  itemId: string;
  quantity: string;
  rateExclusive: string;
  rateInclusive: string;
  taxRate: string;
  godownId: string;
  appliedSchemeId?: string;
  appliedSchemeLabel?: string;
  freeQuantity?: number;
  autoRateExclusive?: string;
  autoRateInclusive?: string;
  priceOverridden?: boolean;
}

type InvoicePricingMode = 'MANUAL' | 'PRICE_LIST';

function buildLineRatesFromItem(
  item: InventoryItem,
  pricingMode: InvoicePricingMode,
  activePriceList: PriceList | null,
  customerLedgerId: string
): Partial<ItemLineState> {
  if (pricingMode === 'PRICE_LIST' && activePriceList) {
    const resolved = priceListService.resolveItemRates(activePriceList, item);
    if (resolved) {
      return {
        itemId: item.id,
        taxRate: String(resolved.gstRate),
        rateExclusive: String(resolved.rateExclusive),
        rateInclusive: String(resolved.rateInclusive),
        autoRateExclusive: String(resolved.rateExclusive),
        autoRateInclusive: String(resolved.rateInclusive),
        priceOverridden: false,
      };
    }
  }
  const mem =
    customerLedgerId && item.id ? rateMemory.getLastSaleExclusive(customerLedgerId, item.id) : null;
  const sale = mem ?? Number(item.pricing?.sale ?? 0);
  const gst = Number(item.gstRate ?? 0);
  const inclusive = gst ? sale * (1 + gst / 100) : sale;
  return {
    itemId: item.id,
    taxRate: String(gst),
    rateExclusive: String(sale),
    rateInclusive: Number.isFinite(inclusive) ? inclusive.toFixed(2) : String(sale),
    autoRateExclusive: undefined,
    autoRateInclusive: undefined,
    priceOverridden: false,
  };
}

const SCREEN_ID = 'sales-voucher-form';

const buildLineFieldId = (lineId: string, field: string) => `sales-line-${lineId}-${field}`;

const toNumber = (value: string | number | undefined, precision = 2) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(precision));
};

const amountToWordsINR = (amount: number): string => {
  const n = Math.round(Number(amount || 0));
  if (n <= 0) return 'Zero Rupees Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigits = (x: number) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ''}`.trim());
  const threeDigits = (x: number) => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return `${h ? `${ones[h]} Hundred${r ? ' ' : ''}` : ''}${r ? twoDigits(r) : ''}`.trim();
  };
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const chunks = [
    crore ? `${threeDigits(crore)} Crore` : '',
    lakh ? `${threeDigits(lakh)} Lakh` : '',
    thousand ? `${threeDigits(thousand)} Thousand` : '',
    rest ? threeDigits(rest) : '',
  ].filter(Boolean);
  return `${chunks.join(' ')} Rupees Only`;
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
  const [searchParams] = useSearchParams();
  const mountedRef = useRef(true);
  const { id: editVoucherId } = useParams<{ id?: string }>();
  const { can } = usePermission();
  const canCreate = can('create-vouchers');
  const isEditMode = Boolean(editVoucherId);
  const listPath = '/sales/tax-invoices';

  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
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
  const editLoadedRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [mode, setMode] = useState<'edit' | 'view'>(() => (editVoucherId ? 'view' : 'edit'));
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [voucherEwayBill, setVoucherEwayBill] = useState<VoucherEwayBill | undefined>(undefined);
  const [ewayThresholdOpen, setEwayThresholdOpen] = useState(false);
  const [ewayDetailsOpen, setEwayDetailsOpen] = useState(false);
  const [ewayDetailsOnly, setEwayDetailsOnly] = useState(false);
  const [pendingSaveOptions, setPendingSaveOptions] = useState<
    { navigateAfter?: boolean; redirectTo?: string } | null
  >(null);
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalChargeState[]>([]);
  const [enableRoundOff, setEnableRoundOff] = useState(true);
  const [companyState, setCompanyState] = useState<string>(''); // Will be loaded from company config

  // Quick create ledger dialogs
  const [showQuickCreateCustomer, setShowQuickCreateCustomer] = useState(false);
  const [showQuickCreateSales, setShowQuickCreateSales] = useState(false);
  const [showQuickCreateItem, setShowQuickCreateItem] = useState(false);
  const [invoiceTemplateOverride, setInvoiceTemplateOverride] = useState<InvoiceTemplateId | null>(null);
  const [printSetup, setPrintSetup] = useState<{ open: boolean; action: PrintExportAction; applyOnly?: boolean }>({
    open: false,
    action: 'print',
  });
  const [pendingScannedBarcode, setPendingScannedBarcode] = useState('');
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [itemPickerLineId, setItemPickerLineId] = useState<string | null>(null);
  const [itemPickerInitialQuery, setItemPickerInitialQuery] = useState('');
  const {
    items: inventoryItems,
    setItems: setInventoryItems,
    reload: reloadInventoryItems,
  } = useActiveInventoryItems({ reloadWhen: itemPickerLineId });
  const [customerConfirmOpen, setCustomerConfirmOpen] = useState(false);
  const [pendingCustomerDetails, setPendingCustomerDetails] = useState<(Partial<PartyInfo> & { partyId?: string }) | null>(null);
  const [pricingMode, setPricingMode] = useState<InvoicePricingMode>('MANUAL');
  const [priceListId, setPriceListId] = useState('');
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [unitLabelById, setUnitLabelById] = useState<Map<string, string>>(new Map());
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const customerPinAutofill = usePincodeAutofill({
    onFilled: useCallback((addr) => {
      setPendingCustomerDetails((prev) => ({
        ...(prev || {}),
        city: addr.city,
        district: addr.district,
        state: addr.state,
      }));
    }, []),
  });

  useEffect(() => {
    void unitOfMeasureService.list().then((units) => {
      setUnitLabelById(new Map(units.map((u) => [u.id, u.symbol || u.name])));
    });
  }, []);

  useEffect(() => {
    if (!customerConfirmOpen) return;
    customerPinAutofill.resetLastFetched();
    const pin = String(pendingCustomerDetails?.pin || '').replace(/\D/g, '');
    if (pin.length !== 6) return;
    const timer = window.setTimeout(() => {
      void customerPinAutofill.onPincodeInput(pin);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    customerConfirmOpen,
    pendingCustomerDetails?.pin,
    customerPinAutofill.resetLastFetched,
    customerPinAutofill.onPincodeInput,
  ]);

  const [activeSalesSchemes, setActiveSalesSchemes] = useState<Scheme[]>([]);
  const authContext = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('gst_billing_auth') || '{}');
    } catch {
      return {};
    }
  }, []);
  const companyId = authContext?.user?.companyId || authContext?.company?.id || '';

  const linesRef = useRef(lines);
  const itemPickerLineIdRef = useRef(itemPickerLineId);
  const suppressNextItemFocusOpenRef = useRef(false);
  const suppressNextPartyFocusOpenRef = useRef(false);
  const lineItemsSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
      if (el.closest?.('[role="dialog"], [data-list-picker-modal]')) return;
      e.preventDefault();
      navigate(listPath);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [navigate]);

  const [formState, setFormState] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    number: '', // Will be generated in useEffect
    dueDate: '',
    paymentTerms: '',
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

  const parsePaymentTermDays = useCallback((value: string): number | null => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const match = raw.match(/\d+/);
    if (!match) return null;
    const days = Number(match[0]);
    if (!Number.isFinite(days) || days < 0) return null;
    return Math.floor(days);
  }, []);

  const toDueDateByDays = useCallback((invoiceDate: string, days: number): string => {
    const base = dayjs(invoiceDate);
    if (!base.isValid()) return '';
    return base.add(days, 'day').format('YYYY-MM-DD');
  }, []);

  const [partyDraft, setPartyDraft] = useState<{ billing: PartyInfo; shipping: PartyInfo }>({
    billing: {} as PartyInfo,
    shipping: {} as PartyInfo,
  });
  const companyInfo = useMemo(() => getNormalizedCompanyProfile(), []);

  useEffect(() => {
    if (isEditMode) return;
    let cancelled = false;
    void peekNextInvoiceNumber().then((number) => {
      if (!cancelled) {
        setFormState((prev) => ({ ...prev, number }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isEditMode]);

  useEffect(() => {
    void priceListService.list({ status: 'ACTIVE', activeOnDate: formState.date }).then(setPriceLists);
  }, [formState.date]);

  const activePriceList = useMemo(
    () => priceLists.find((p) => p.id === priceListId) ?? null,
    [priceLists, priceListId]
  );

  const applyCustomerDefaultPriceList = useCallback(async (partyId: string) => {
    if (!partyId) return;
    setSelectedPartyId(partyId);
    try {
      const profile = await partyProfileService.get(partyId);
      if (profile?.priceListId) {
        setPricingMode('PRICE_LIST');
        setPriceListId(profile.priceListId);
      }
    } catch {
      // ignore profile read errors
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadSchemes = async () => {
      if (!companyId) return;
      try {
        const schemes = await schemeService.getSchemes(companyId);
        if (!mounted) return;
        const salesSchemes = schemes.filter((s) => s.appliesTo === 'SALES' || s.appliesTo === 'BOTH');
        setActiveSalesSchemes(salesSchemes);
      } catch {
        if (!mounted) return;
        setActiveSalesSchemes([]);
      }
    };
    loadSchemes();
    return () => {
      mounted = false;
    };
  }, [companyId]);

  useEffect(() => {
    if (activeSalesSchemes.length === 0) {
      setLines((prev) => {
        let changed = false;
        const cleared = prev.map((line) => {
          if (!line.appliedSchemeId && !line.appliedSchemeLabel && !line.freeQuantity) {
            return line;
          }
          changed = true;
          return {
            ...line,
            appliedSchemeId: undefined,
            appliedSchemeLabel: undefined,
            freeQuantity: 0,
          };
        });
        return changed ? cleared : prev;
      });
      return;
    }
    const txnDate = formState.date ? new Date(formState.date) : new Date();
    setLines((prev) => {
      let changed = false;
      const next = prev.map((line) => {
        const qty = toNumber(line.quantity, 4);
        if (!line.itemId || qty <= 0) {
          if (!line.appliedSchemeId && !line.appliedSchemeLabel && !line.freeQuantity) {
            return line;
          }
          changed = true;
          return {
            ...line,
            appliedSchemeId: undefined,
            appliedSchemeLabel: undefined,
            freeQuantity: 0,
          };
        }
        const best = getBestScheme(line.itemId, qty, 'SALES', activeSalesSchemes, txnDate);
        if (!best) {
          if (!line.appliedSchemeId && !line.appliedSchemeLabel && !line.freeQuantity) {
            return line;
          }
          changed = true;
          return {
            ...line,
            appliedSchemeId: undefined,
            appliedSchemeLabel: undefined,
            freeQuantity: 0,
          };
        }
        const qtyImpact = calculateFinalQuantity(best.scheme, qty);
        const freeQty = qtyImpact.freeQuantity || best.benefit.freeQuantity || 0;
        const label = best.benefit.description || best.scheme.name;
        if (
          line.appliedSchemeId === best.scheme.id &&
          line.appliedSchemeLabel === label &&
          (line.freeQuantity || 0) === freeQty
        ) {
          return line;
        }
        changed = true;
        return {
          ...line,
          appliedSchemeId: best.scheme.id,
          appliedSchemeLabel: label,
          freeQuantity: freeQty,
        };
      });
      return changed ? next : prev;
    });
  }, [activeSalesSchemes, formState.date, lines]);

  useEffect(() => {
    const days = parsePaymentTermDays(formState.paymentTerms);
    if (days === null || !formState.date) return;
    const nextDueDate = toDueDateByDays(formState.date, days);
    if (!nextDueDate || nextDueDate === formState.dueDate) return;
    setFormState((prev) => ({ ...prev, dueDate: nextDueDate }));
  }, [formState.date, formState.paymentTerms, formState.dueDate, parsePaymentTermDays, toDueDateByDays]);

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
    let mounted = true;
    const ensureDefaultLedgers = async () => {
      try {
        const core = await autoLedgerService.ensureCore();
        if (!mounted) return;
        setFormState((prev) => ({
          ...prev,
          salesLedgerId: prev.salesLedgerId || core.salesLedgerId,
          gstLedgerId: prev.gstLedgerId || core.gstLedgerId,
        }));
        const refreshed = await ledgerAccountService.list({ includeInactive: false });
        if (!mounted) return;
        setLedgerAccounts(refreshed);
      } catch (e) {
        console.warn('Failed to auto-bind default ledgers for Sales Voucher', e);
      }
    };
    void ensureDefaultLedgers();
    return () => {
      mounted = false;
    };
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
    let mounted = true;
    const loadForEdit = async () => {
      try {
        const voucher = await voucherService.getById(editVoucherId);
        if (!mounted) return;
        if (!voucher || voucher.type !== 'SALES') {
          setError('Sales voucher not found for edit.');
          return;
        }
        const customerLine = voucher.lines.find((line) => (line.debit ?? 0) > 0);
        const customerLedgerId = String(customerLine?.ledgerId || '');
        const linkedParty = parties.find((p) => p.ledgerId === customerLedgerId) || null;
        const linkedLedger = ledgerAccounts.find((acct) => acct.id === customerLedgerId) || null;
        const itemLines = voucher.lines.filter((line) => line.itemId && Number(line.quantity || 0) > 0);
        const mappedLines =
          itemLines.length > 0
            ? itemLines.map((line) => {
                const qty = Number(line.quantity || 0);
                const amount = Number(line.credit || line.debit || 0);
                const rateExclusive = qty > 0 ? Number((amount / qty).toFixed(2)) : 0;
                const inv = inventoryItems.find((it) => it.id === String(line.itemId));
                const gst = Number(inv?.gstRate ?? 0);
                return {
                  lineId: generateId('s-line'),
                  itemId: String(line.itemId || ''),
                  quantity: String(qty || ''),
                  rateExclusive: String(rateExclusive || ''),
                  rateInclusive: String(rateExclusive || ''),
                  taxRate: String(gst || 0),
                  godownId: String(line.godownId || formState.defaultGodownId || ''),
                  appliedSchemeId: undefined,
                  appliedSchemeLabel: undefined,
                  freeQuantity: 0,
                } as ItemLineState;
              })
            : [createLine(formState.defaultGodownId)];
        setLines(mappedLines);
        setFormState((prev) => ({
          ...prev,
          date: dayjs(voucher.date).format('YYYY-MM-DD'),
          number: voucher.number,
          narration: String(voucher.narration || ''),
          customerLedgerId,
        }));
        setVoucherEwayBill(voucher.ewayBill);
        setMode('view');
        if (linkedParty) {
          const resolvedLinkedLedgerId = String(linkedParty.ledgerId || customerLedgerId || '');
          setPartyDraft({
            billing: {
              ledgerId: resolvedLinkedLedgerId,
              name: linkedParty.name || '',
              gstin: linkedParty.gstin || '',
              address: linkedParty.address || '',
              phone: linkedParty.mobile || '',
              email: linkedParty.email || '',
              city: linkedParty.city || '',
              state: linkedParty.state || '',
              pin: linkedParty.pincode || '',
            },
            shipping: {
              ledgerId: resolvedLinkedLedgerId,
              name: linkedParty.name || '',
              gstin: linkedParty.gstin || '',
              address: linkedParty.address || '',
              phone: linkedParty.mobile || '',
              email: linkedParty.email || '',
              city: linkedParty.city || '',
              state: linkedParty.state || '',
              pin: linkedParty.pincode || '',
            },
          });
        } else if (linkedLedger) {
          setPartyDraft({
            billing: {
              ledgerId: linkedLedger.id,
              name: linkedLedger.name || '',
              gstin: linkedLedger.gstDetails?.gstin || '',
              address: linkedLedger.contactDetails?.address || '',
              phone: linkedLedger.contactDetails?.phone || '',
              email: linkedLedger.contactDetails?.email || '',
              city: '',
              state: '',
              pin: '',
            },
            shipping: {
              ledgerId: linkedLedger.id,
              name: linkedLedger.name || '',
              gstin: linkedLedger.gstDetails?.gstin || '',
              address: linkedLedger.contactDetails?.address || '',
              phone: linkedLedger.contactDetails?.phone || '',
              email: linkedLedger.contactDetails?.email || '',
              city: '',
              state: '',
              pin: '',
            },
          });
        }
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
  }, [editVoucherId, parties, inventoryItems, formState.defaultGodownId, ledgerAccounts]);

  useEffect(() => {
    if (isEditMode) return;
    const customerId = searchParams.get('customerId');
    let pipelineId: string | null = null;
    try {
      const raw = sessionStorage.getItem(PIPELINE_PREFILL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { pipelineId?: string };
        pipelineId = parsed.pipelineId ?? null;
        sessionStorage.removeItem(PIPELINE_PREFILL_KEY);
      }
    } catch {
      // ignore invalid prefill payload
    }
    if (!pipelineId && !customerId) return;
    if (!parties.length) return;

    void (async () => {
      const applyParty = (party: Party) => {
        const ledgerId = String(party.ledgerId || '');
        setPartyDraft({
          billing: {
            ledgerId,
            name: party.name || '',
            gstin: party.gstin || '',
            address: party.address || '',
            phone: party.mobile || '',
            email: party.email || '',
            city: party.city || '',
            state: party.state || '',
            pin: party.pincode || '',
          },
          shipping: {
            ledgerId,
            name: party.name || '',
            gstin: party.gstin || '',
            address: party.address || '',
            phone: party.mobile || '',
            email: party.email || '',
            city: party.city || '',
            state: party.state || '',
            pin: party.pincode || '',
          },
        });
        setFormState((prev) => ({ ...prev, customerLedgerId: ledgerId }));
        void applyCustomerDefaultPriceList(party.id);
      };

      if (pipelineId) {
        const doc = await salesPipelineService.getById(pipelineId);
        if (!doc) return;
        const party =
          parties.find((p) => p.id === doc.customerId) ??
          parties.find((p) => p.name === doc.customerName) ??
          null;
        if (party) applyParty(party);

        const mappedLines = doc.lines
          .map((line) => {
            const inv =
              inventoryItems.find((item) => item.id === line.itemId) ??
              inventoryItems.find((item) => item.name === line.itemName);
            if (!inv) return null;
            return {
              lineId: generateId('s-line'),
              itemId: inv.id,
              quantity: String(line.qty ?? 1),
              rateExclusive: String(line.rate ?? 0),
              rateInclusive: '',
              taxRate: String(line.gstPercent ?? inv.gstRate ?? 0),
              godownId: formState.defaultGodownId || '',
            } as ItemLineState;
          })
          .filter(Boolean) as ItemLineState[];
        if (mappedLines.length > 0) setLines(mappedLines);
        return;
      }

      if (customerId) {
        const party = parties.find((p) => p.id === customerId);
        if (party) applyParty(party);
      }
    })();
  }, [isEditMode, searchParams, parties, inventoryItems, formState.defaultGodownId, applyCustomerDefaultPriceList]);

  useEffect(() => {
    if (!formState.number) return;
    const label = isEditMode
      ? `Tax Invoice — ${formState.number}`
      : 'New Tax Invoice';
    document.title = `${label} | PVE InvoicePro 360`;
  }, [formState.number, isEditMode]);

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
          let next = { ...line, ...patch };
          if (patch.itemId && patch.itemId !== line.itemId) {
            const selectedItem = itemMap.get(patch.itemId);
            if (selectedItem) {
              next = {
                ...next,
                ...buildLineRatesFromItem(
                  selectedItem,
                  pricingMode,
                  activePriceList,
                  formState.customerLedgerId
                ),
              };
            }
          }
          if (patch.rateExclusive !== undefined || patch.rateInclusive !== undefined) {
            const autoEx = line.autoRateExclusive;
            const autoIn = line.autoRateInclusive;
            const ex = patch.rateExclusive ?? line.rateExclusive;
            const inc = patch.rateInclusive ?? line.rateInclusive;
            const overridden =
              Boolean(autoEx || autoIn) &&
              ((Boolean(autoEx) && ex !== autoEx) || (Boolean(autoIn) && inc !== autoIn));
            next.priceOverridden = overridden;
          }
          return next;
        })
      );
    },
    [itemMap, pricingMode, activePriceList, formState.customerLedgerId]
  );

  const placeItemFromScan = useCallback(
    (item: InventoryItem) => {
      setLines((prev) => {
        const next = [...prev];
        let targetIdx = next.findIndex((line) => !line.itemId);
        if (targetIdx < 0) {
          const lastIdx = next.length - 1;
          const last = next[lastIdx];
          if (isLineDataValid(last) && (godowns.length === 0 || Boolean(last.godownId))) {
            const nl = createLine(last.godownId || formState.defaultGodownId);
            next.push(nl);
            targetIdx = next.length - 1;
          } else {
            targetIdx = lastIdx;
          }
        }
        next[targetIdx] = {
          ...next[targetIdx],
          ...buildLineRatesFromItem(item, pricingMode, activePriceList, formState.customerLedgerId),
        };
        focusRegistry.queueFocus(buildLineFieldId(next[targetIdx].lineId, 'quantity'));
        return next;
      });
    },
    [formState.customerLedgerId, formState.defaultGodownId, godowns.length, pricingMode, activePriceList]
  );

  useEffect(() => {
    if (pricingMode !== 'PRICE_LIST' || !activePriceList) return;
    setLines((prev) =>
      prev.map((line) => {
        if (!line.itemId) return line;
        const item = itemMap.get(line.itemId);
        if (!item) return line;
        return {
          ...line,
          ...buildLineRatesFromItem(item, 'PRICE_LIST', activePriceList, formState.customerLedgerId),
        };
      })
    );
  }, [priceListId, pricingMode, activePriceList, formState.customerLedgerId, itemMap]);

  const handleScannedBarcode = useCallback(
    (raw: string) => {
      const scanned = raw.trim();
      if (!scanned) return;
      const found = inventoryItems.find(
        (it) => String(it.barcode ?? '').trim().toLowerCase() === scanned.toLowerCase()
      );
      if (found) {
        setError(null);
        placeItemFromScan(found);
        return;
      }
      setPendingScannedBarcode(scanned);
      setShowQuickCreateItem(true);
      setError(`Barcode "${scanned}" item list mein nahi mila. Naya item bana sakte hain.`);
    },
    [inventoryItems, placeItemFromScan]
  );

  useEffect(() => {
    const buffer = { value: '', lastAt: 0 };
    const GAP_MS = 90;
    const MIN_LEN = 4;

    const shouldIgnoreTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el?.isConnected) return true;
      if (el.closest('[role="dialog"], [data-list-picker-modal], .MuiMenu-root, .MuiPopover-root')) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (showQuickCreateItem || showQuickCreateCustomer || showQuickCreateSales || partyPickerOpen || itemPickerLineId !== null) return;
      if (shouldIgnoreTarget(e.target)) return;

      const now = Date.now();
      if (now - buffer.lastAt > GAP_MS) {
        buffer.value = '';
      }
      buffer.lastAt = now;

      if (e.key === 'Enter') {
        const code = buffer.value.trim();
        buffer.value = '';
        if (code.length >= MIN_LEN) {
          e.preventDefault();
          handleScannedBarcode(code);
        }
        return;
      }

      if (e.key.length === 1) {
        buffer.value += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleScannedBarcode,
    itemPickerLineId,
    partyPickerOpen,
    showQuickCreateCustomer,
    showQuickCreateItem,
    showQuickCreateSales,
  ]);

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
    
    // 6. Round-Off (if enabled and non-zero) - keep sign same as posting builder
    if (enableRoundOff && totals.roundOff !== 0) {
      if (totals.roundOff > 0) {
        // Positive round-off is credited in GST builder
        entries.push({
          ledgerId: 'round-off',
          ledgerName: 'Round Off',
          debit: 0,
          credit: totals.roundOff,
          description: `Round-off adjustment ₹${totals.roundOff.toFixed(2)}`,
        });
      } else {
        // Negative round-off is debited in GST builder
        entries.push({
          ledgerId: 'round-off',
          ledgerName: 'Round Off',
          debit: Math.abs(totals.roundOff),
          credit: 0,
          description: `Round-off adjustment ₹${Math.abs(totals.roundOff).toFixed(2)}`,
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

  const negativeStockWarnings = useMemo(() => {
    return lines
      .filter((line) => line.itemId && toNumber(line.quantity) > 0)
      .map((line, index) => {
        const item = itemMap.get(line.itemId);
        if (!item) return null;
        const requested = toNumber(line.quantity, 4);
        const available = line.godownId
          ? Number(item.godownStocks?.find((s) => s.godownId === line.godownId)?.quantity ?? 0)
          : Number(item.currentStock ?? 0);
        const projected = Number((available - requested).toFixed(4));
        if (projected >= 0) return null;
        const godownName = godowns.find((g) => g.id === line.godownId)?.name ?? line.godownId ?? 'Default';
        return {
          lineNo: index + 1,
          itemName: item.name,
          godownName,
          available,
          requested,
          negativeBy: Math.abs(projected),
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [lines, itemMap, godowns]);

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

  const resolvedCustomerAddress = String(
    partyDraft.billing.address ||
      ledgerAccounts.find((acct) => acct.id === formState.customerLedgerId)?.contactDetails?.address ||
      ''
  ).trim();
  const hasValidLines = lines.some((line) => isLineDataValid(line));
  const hasInvalidPartialLines = lines.some((line) => {
    const touched =
      Boolean(line.itemId) ||
      toNumber(line.quantity) > 0 ||
      toNumber(line.rateExclusive) > 0 ||
      Boolean(line.godownId);
    return touched && !isLineDataValid(line);
  });

  const canSubmit =
    canCreate &&
    formState.date &&
    formState.number &&
    formState.customerLedgerId &&
    resolvedCustomerAddress.length > 0 &&
    hasValidLines &&
    !hasInvalidPartialLines &&
    !saving;

  const getValidationIssues = useCallback(() => {
    const issues: string[] = [];

    if (!formState.date) issues.push('Invoice date is required.');
    if (!formState.number) issues.push('Invoice number is required.');
    if (!formState.customerLedgerId) issues.push('Please select a customer/party.');
    if (!resolvedCustomerAddress) issues.push('Customer address is required.');

    lines.forEach((line, index) => {
      const touched =
        Boolean(line.itemId) ||
        toNumber(line.quantity) > 0 ||
        toNumber(line.rateExclusive) > 0 ||
        Boolean(line.godownId);
      if (!touched) return;
      const row = index + 1;
      if (!line.itemId) issues.push(`Line ${row}: item is missing.`);
      if (toNumber(line.quantity) <= 0) issues.push(`Line ${row}: quantity must be greater than 0.`);
      if (toNumber(line.rateExclusive) <= 0) issues.push(`Line ${row}: rate must be greater than 0.`);
      if (godowns.length > 0 && !line.godownId) issues.push(`Line ${row}: godown is required.`);
    });

    return issues;
  }, [
    formState.customerLedgerId,
    formState.date,
    formState.gstLedgerId,
    formState.number,
    formState.salesLedgerId,
    godowns.length,
    gstRequired,
    lines,
    resolvedCustomerAddress,
    postingBalanced,
  ]);

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

    // Use the GST builder to create properly bifurcated voucher lines.
    // If UI holds a stale/inactive sales ledger id, force fallback to system GST Sales ledger.
    const coreLedgers = await autoLedgerService.ensureCore();
    const selectedSalesLedgerId = String(formState.salesLedgerId || '').trim();
    let resolvedSalesLedgerId = coreLedgers.salesLedgerId;
    if (selectedSalesLedgerId) {
      const selectedSalesLedger = await ledgerAccountService.getById(selectedSalesLedgerId);
      if (selectedSalesLedger && selectedSalesLedger.isActive !== false) {
        resolvedSalesLedgerId = selectedSalesLedgerId;
      } else {
        setFormState((prev) =>
          prev.salesLedgerId === selectedSalesLedgerId
            ? { ...prev, salesLedgerId: coreLedgers.salesLedgerId }
            : prev
        );
      }
    }
    const { lines: voucherLines } = await buildSalesVoucherLinesWithGST({
      customerLedgerId: formState.customerLedgerId,
      salesLedgerId: resolvedSalesLedgerId,
      lines: lineItems,
      additionalCharges: chargesForBuilder,
      companyState: companyStateValue,
      partyState: partyDraft.billing.state || '',
      narration: formState.narration,
    });

    return voucherLines;
  };

  const resolvePrintFormat = (): { format: PrintFormat; landscape: boolean; showSignature: boolean; fontSize: 'compact' | 'normal' } => {
    const uiSettingsRaw = localStorage.getItem('invoice-settings');
    const uiSettings = uiSettingsRaw ? JSON.parse(uiSettingsRaw) : {};
    const pageSize: string = uiSettings?.pageSize || 'A4';
    const orientation: string = uiSettings?.orientation || 'portrait';
    const fontSizeValue: string = uiSettings?.fontSize || '12';
    const showSignature: boolean = Boolean(uiSettings?.showSignature ?? true);
    const landscape = orientation === 'landscape';
    const format: PrintFormat =
      pageSize === 'THERMAL_80'
        ? 'THERMAL_80'
        : pageSize === 'THERMAL_58'
        ? 'THERMAL_58'
        : pageSize === 'A5'
        ? landscape
          ? 'A5_LANDSCAPE'
          : 'A5_PORTRAIT'
        : landscape
        ? 'A4_LANDSCAPE'
        : 'A4_PORTRAIT';
    return { format, landscape, showSignature, fontSize: Number(fontSizeValue) <= 12 ? 'compact' : 'normal' };
  };

  const buildCurrentInvoiceHtml = async (
    opts?: PrintExportBuildInput
  ): Promise<{ html: string; fileName: string; landscape: boolean }> => {
    const companyInfoRaw = localStorage.getItem('company-info');
    const companyLogo = localStorage.getItem('companyLogo') || '';
    const companySignature = localStorage.getItem('companySignature') || '';
    const companyParsed = companyInfoRaw ? JSON.parse(companyInfoRaw) : {};
    const company = {
      name: String(companyParsed?.name || companyParsed?.businessName || companyInfo.name || localStorage.getItem('companyName') || 'Company'),
      address: String(companyParsed?.address || companyInfo.address || ''),
      gstin: String(companyParsed?.gstin || companyInfo.gstin || ''),
      phone: String(companyParsed?.phone || companyInfo.phone || ''),
      email: String(companyParsed?.email || companyInfo.email || ''),
      website: String(companyParsed?.website || companyInfo.website || ''),
      city: String(companyParsed?.city || companyInfo.city || ''),
      pinCode: String(companyParsed?.pinCode || companyInfo.pinCode || ''),
      bank: String(companyParsed?.bank || companyInfo.bank || ''),
      accountNo: String(companyParsed?.accountNo || companyInfo.accountNo || ''),
      ifsc: String(companyParsed?.ifsc || companyInfo.ifsc || ''),
      logo: companyLogo || undefined,
      signature: companySignature || undefined,
    };
    const pageSize = opts?.pageSize || getInvoicePrintLayout().pageSize;
    const orientation = opts?.orientation || getInvoicePrintLayout().orientation;
    const { format, landscape, showSignature, fontSize } = resolvePrintFormatFromLayout(pageSize, orientation);
    const items = lines
      .filter((l) => l.itemId && toNumber(l.quantity) > 0)
      .map((l) => {
        const amount = computeLineAmount(l);
        const taxBif = bifurcateTax(computeLineTax(l), toNumber(l.taxRate), totals.taxType as 'CGST_SGST' | 'IGST');
        const product = itemMap.get(l.itemId);
        const unitLabel = product?.unitId
          ? unitLabelById.get(product.unitId) ?? product.unitId
          : 'Nos';
        return {
          name: getItemName(l.itemId),
          hsn: String(product?.hsnCode ?? ''),
          qty: toNumber(l.quantity),
          unit: unitLabel,
          rate: toNumber(l.rateExclusive),
          discount: 0,
          taxPercent: toNumber(l.taxRate),
          amount,
          cgst: taxBif.cgst,
          sgst: taxBif.sgst,
          igst: taxBif.igst,
        };
      });
    const templateId = opts?.templateId || invoiceTemplateOverride || getInvoiceTemplateId();
    const html = await buildInvoiceHTML(
      format,
      company as any,
      {
        invoiceNumber: formState.number,
        invoiceDate: formState.date,
        dueDate: formState.dueDate || undefined,
        customerName: String(partyDraft.billing.name || ''),
        customerGSTIN: String(partyDraft.billing.gstin || ''),
        customerPhone: String(partyDraft.billing.phone || ''),
        buyerAddress: String(partyDraft.billing.address || ''),
        sellerAddress: String(company.address || ''),
        billToAddress: String(partyDraft.billing.address || ''),
        shipToAddress: String(partyDraft.shipping.address || partyDraft.billing.address || ''),
        shipToName: String(partyDraft.shipping.name || partyDraft.billing.name || ''),
        customerSealLabel: 'Customer Seal & Signature',
        items,
        subtotal: Number(totals.subtotal || 0),
        cgstTotal: Number(totals.itemTaxBifurcated.cgst + totals.chargeTaxBifurcated.cgst || 0),
        sgstTotal: Number(totals.itemTaxBifurcated.sgst + totals.chargeTaxBifurcated.sgst || 0),
        igstTotal: Number(totals.itemTaxBifurcated.igst + totals.chargeTaxBifurcated.igst || 0),
        discountTotal: 0,
        roundOff: Number(totals.roundOff || 0),
        grandTotal: Number(totals.grandTotal || 0),
        amountInWords: amountToWordsINR(Number(totals.grandTotal || 0)),
        termsAndConditions: String(formState.termsAndConditions || '').trim() || undefined,
        ewayBillBlock: buildEwayPrintBlock(voucherEwayBill),
        declaration:
          'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
      } as any,
      {
        showTaxBreakup: true,
        showSignature,
        showDeclaration: true,
        logoPosition: 'top-left',
        fontSize,
        margin: 'normal',
      },
      templateId
    );
    return { html, fileName: `${formState.number}.pdf`, landscape };
  };

  const runFormPrintAction = useCallback(
    async (action: PrintExportAction) => {
      const result = await runInvoicePrintExportAction({
        action,
        onNeedSetup: (next) => setPrintSetup({ open: true, action: next }),
        buildPackage: (input) => buildCurrentInvoiceHtml(input),
        whatsAppMeta: {
          invoiceNumber: formState.number,
          invoiceDate: formState.date,
          grandTotal: Number(totals.grandTotal || 0),
          phone: partyDraft.billing.phone,
        },
      });
      if (!result.ok && result.error) {
        window.alert(result.error);
      }
    },
    [formState.number, formState.date, totals.grandTotal, partyDraft.billing.phone, buildCurrentInvoiceHtml, navigate, listPath]
  );

  useEffect(() => {
    if (!isEditMode || editLoadedRef.current !== editVoucherId) return;
    if (searchParams.get('print') === '1') {
      void runFormPrintAction('print').then(() => navigate(listPath));
    } else if (searchParams.get('send') === 'whatsapp') {
      void runFormPrintAction('whatsapp');
    } else if (searchParams.get('send') === 'email') {
      setSendDialogOpen(true);
    }
  }, [searchParams, isEditMode, editVoucherId, runFormPrintAction, navigate, listPath]);

  const executeSaveVoucher = async (
    ewayOverride: VoucherEwayBill | undefined,
    options?: { navigateAfter?: boolean; redirectTo?: string }
  ): Promise<string | null> => {
    if (!canSubmit) {
      const issues = getValidationIssues();
      setValidationIssues(issues);
      setError('Please complete all required fields before saving.');
      return null;
    }
    try {
      setSaving(true);
      setError(null);
      setValidationIssues([]);
      const voucherLines = await buildVoucherLines();
      const dueTokens = [
        formState.dueDate ? `DUE[${formState.dueDate}]` : '',
        formState.paymentTerms ? `PTERM[${formState.paymentTerms}]` : '',
      ].filter(Boolean);
      const narrationWithTerms = `${String(formState.narration || '').trim()} ${dueTokens.join(' ')}`.trim();
      const voucherDate = `${formState.date}T12:00:00.000Z`;
      const resolvedEway =
        ewayOverride ??
        voucherEwayBill ??
        buildEwayBillForSkipSave(Number(totals.grandTotal || 0));

      let savedId = editVoucherId ?? null;
      if (isEditMode && editVoucherId) {
        await voucherService.update(editVoucherId, {
          type: 'SALES',
          date: voucherDate,
          number: formState.number,
          narration: narrationWithTerms,
          lines: voucherLines,
          ewayBill: resolvedEway,
        });
      } else {
        const created = await voucherService.create({
          type: 'SALES',
          date: voucherDate,
          number: formState.number,
          narration: narrationWithTerms,
          lines: voucherLines,
          ewayBill: resolvedEway,
        });
        savedId = created.id;
        if (!options?.navigateAfter && savedId) {
          navigate(`/sales/invoices/${savedId}`, { replace: true });
        }
      }
      setVoucherEwayBill(resolvedEway);
      const appliedSchemeTotals = new Map<string, number>();
      lines.forEach((line) => {
        if (!line.appliedSchemeId) return;
        const lineAmount = computeLineAmount(line);
        if (lineAmount <= 0) return;
        appliedSchemeTotals.set(
          line.appliedSchemeId,
          Number(((appliedSchemeTotals.get(line.appliedSchemeId) || 0) + lineAmount).toFixed(2))
        );
      });
      if (formState.customerLedgerId && appliedSchemeTotals.size > 0) {
        await Promise.allSettled(
          Array.from(appliedSchemeTotals.entries()).map(([schemeId, invoiceAmount]) =>
            schemeService.updateSchemeProgress({
              schemeId,
              retailerId: formState.customerLedgerId,
              invoiceAmount,
              paymentReceived: 0,
              paymentPending: invoiceAmount,
            })
          )
        );
      }
      const custId = formState.customerLedgerId;
      if (custId) {
        for (const line of lines) {
          const ex = toNumber(line.rateExclusive);
          if (line.itemId && ex > 0) {
            rateMemory.setLastSaleExclusive(custId, line.itemId, ex);
          }
        }
      }
      if (pricingMode === 'PRICE_LIST' && priceListId) {
        await priceListService.recordUsage(priceListId);
      }
      if (options?.navigateAfter) navigate(options.redirectTo ?? listPath);
      setMode('view');
      return savedId;
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message ?? (isEditMode ? 'Failed to update voucher' : 'Failed to create voucher'));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  };

  const requestSaveVoucher = async (options?: { navigateAfter?: boolean; redirectTo?: string }) => {
    if (!canSubmit) {
      const issues = getValidationIssues();
      setValidationIssues(issues);
      setError('Please complete all required fields before saving.');
      return null;
    }
    if (shouldShowEwayReminder(Number(totals.grandTotal || 0))) {
      setPendingSaveOptions(options ?? null);
      setEwayThresholdOpen(true);
      return null;
    }
    return executeSaveVoucher(undefined, options);
  };

  const handleEwaySkipAndSave = () => {
    setEwayThresholdOpen(false);
    const opts = pendingSaveOptions ?? undefined;
    setPendingSaveOptions(null);
    void executeSaveVoucher(buildEwayBillForSkipSave(Number(totals.grandTotal || 0)), opts);
  };

  const handleEwayAddDetails = () => {
    setEwayThresholdOpen(false);
    setEwayDetailsOnly(false);
    setEwayDetailsOpen(true);
  };

  const handleEwayDetailsSave = (values: EwayBillFormValues) => {
    const eway = formValuesToEwayBill(values, Number(totals.grandTotal || 0), voucherEwayBill?.status);
    setEwayDetailsOpen(false);
    if (ewayDetailsOnly && editVoucherId) {
      void patchVoucherEwayBill(editVoucherId, eway).then(() => setVoucherEwayBill(eway));
      setEwayDetailsOnly(false);
      return;
    }
    const opts = pendingSaveOptions ?? undefined;
    setPendingSaveOptions(null);
    void executeSaveVoucher(eway, opts);
  };

  const printEwayDetails = () => {
    if (!voucherEwayBill) return;
    const html = buildEwayPrintDocumentHtml(
      formState.number,
      String(partyDraft.billing.name || ''),
      voucherEwayBill
    );
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const saveVoucher = requestSaveVoucher;

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void saveVoucher({ navigateAfter: false });
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
    district: partyDraft.billing.district,
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
    district: partyDraft.shipping.district ?? billingParty.district,
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

  const applyConfirmedCustomer = useCallback(async () => {
    const payload = pendingCustomerDetails;
    if (!payload) {
      setCustomerConfirmOpen(false);
      return;
    }
    if (!String(payload.address || '').trim()) {
      return;
    }
    handlePartyChange({
      billing: {
        ...payload,
        ledgerId: String(payload.ledgerId || ''),
      },
    });
    if (payload.partyId) {
      void applyCustomerDefaultPriceList(payload.partyId);
      try {
        const updated = await partyService.update(payload.partyId, {
          name: String(payload.name || ''),
          mobile: String(payload.phone || ''),
          gstin: String(payload.gstin || ''),
          address: String(payload.address || ''),
          state: String(payload.state || ''),
          pincode: String(payload.pin || ''),
          email: String(payload.email || ''),
          city: String(payload.city || ''),
          district: String(payload.district || ''),
        });
        setParties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } catch (e) {
        setError((e as Error).message || 'Failed to save customer details.');
        return;
      }
    }
    setCustomerConfirmOpen(false);
    setPendingCustomerDetails(null);
    const firstLineId = linesRef.current[0]?.lineId;
    if (firstLineId) {
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
        focusRegistry.focusById(buildLineFieldId(firstLineId, 'item'));
      }, 0);
    }
  }, [handlePartyChange, pendingCustomerDetails, applyCustomerDefaultPriceList]);

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

  return (
    <Box component="form" onSubmit={handleFormSubmit} sx={{ pt: 0, pb: 10 }}>
      <Stack spacing={1}>
        <InvoiceHeader
          mode={mode}
          documentTitle={
            isEditMode && formState.number
              ? `Tax Invoice — ${formState.number}`
              : 'New Tax Invoice'
          }
          formState={{
            number: formState.number,
            date: formState.date,
            dueDate: formState.dueDate,
            paymentTerms: formState.paymentTerms,
          }}
          onChange={(patch) => setFormState((prev) => ({ ...prev, ...patch }))}
          company={companyInfo}
          onPrint={() => window.print()}
          onClose={() => navigate(listPath)}
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

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Pricing mode
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <FormControl>
              <RadioGroup
                row
                value={pricingMode}
                onChange={(e) => {
                  const mode = e.target.value as InvoicePricingMode;
                  setPricingMode(mode);
                  if (mode === 'MANUAL') {
                    setPriceListId('');
                  }
                }}
              >
                <FormControlLabel value="MANUAL" control={<Radio size="small" />} label="Manual pricing" />
                <FormControlLabel value="PRICE_LIST" control={<Radio size="small" />} label="Use price list" />
              </RadioGroup>
            </FormControl>
            {pricingMode === 'PRICE_LIST' ? (
              <TextField
                select
                size="small"
                label="Price list"
                value={priceListId}
                onChange={(e) => setPriceListId(e.target.value)}
                sx={{ minWidth: 220 }}
                helperText={
                  selectedPartyId
                    ? 'Customer default applied when available'
                    : 'Select Retail, Wholesale, Dealer, or Contractor'
                }
              >
                <MenuItem value="">Select price list</MenuItem>
                {priceLists.map((pl) => (
                  <MenuItem key={pl.id} value={pl.id}>
                    {pl.name}
                    {pl.pricingType === 'INCLUSIVE' ? ' (Incl. GST)' : ' (Excl. GST)'}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
          </Stack>
        </Paper>

        {error && (
          <Alert
            severity="error"
            onClose={() => {
              setError(null);
              setValidationIssues([]);
            }}
            sx={{ border: '1px solid', borderColor: 'error.main' }}
          >
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: validationIssues.length ? 0.75 : 0 }}>
              {error}
            </Typography>
            {validationIssues.length > 0 && (
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {validationIssues.slice(0, 8).map((issue, idx) => (
                  <li key={`${issue}-${idx}`}>
                    <Typography variant="body2">{issue}</Typography>
                  </li>
                ))}
                {validationIssues.length > 8 && (
                  <li>
                    <Typography variant="body2">
                      +{validationIssues.length - 8} more issue(s). Please review all required fields.
                    </Typography>
                  </li>
                )}
              </Box>
            )}
          </Alert>
        )}

        {gstOverrides.length > 0 && (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            GST rate overridden for {gstOverrides.length} item{gstOverrides.length > 1 ? 's' : ''}. If the new rate is
            meant to stay, edit the inventory master so future invoices stay accurate. Example: {gstOverrides[0].itemName}{' '}
            ({gstOverrides[0].defaultRate}% → {gstOverrides[0].appliedRate}%)
          </Alert>
        )}

        {negativeStockWarnings.length > 0 && (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
              Negative stock warning
            </Typography>
            {negativeStockWarnings.map((warn) => (
              <Typography key={`${warn.lineNo}-${warn.itemName}`} variant="body2">
                Line {warn.lineNo}: {warn.itemName} ({warn.godownName}) - available {warn.available.toFixed(2)}, requested{' '}
                {warn.requested.toFixed(2)}, negative by {warn.negativeBy.toFixed(2)}.
              </Typography>
            ))}
          </Alert>
        )}

        <Card ref={lineItemsSectionRef}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" fontWeight={600}>
                Line Items
              </Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ '& td': { verticalAlign: 'top', py: 0.75 }, minWidth: 1000 }}>
                  <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 200 }}>Item</TableCell>
                    <TableCell sx={{ minWidth: 100, width: 100 }}>Quantity</TableCell>
                    <TableCell sx={{ minWidth: 110, width: 110 }}>GST %</TableCell>
                    <TableCell sx={{ minWidth: 240, width: 240 }}>Rate (Incl/Excl)</TableCell>
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
                      onOpenItemPicker={(rowIndex, initialQuery) => {
                        const lid = lines[rowIndex]?.lineId;
                        if (lid) {
                          setItemPickerInitialQuery(initialQuery || '');
                          setItemPickerLineId(lid);
                        }
                      }}
                      shouldOpenPickerOnItemFocus={() => {
                        if (suppressNextItemFocusOpenRef.current) {
                          suppressNextItemFocusOpenRef.current = false;
                          return false;
                        }
                        return true;
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
            <Box sx={{ p: 1.25, backgroundColor: '#f9f9f9', borderRadius: 1 }}>
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

            <Stack spacing={0.75}>
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

            <Grid container spacing={1}>
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
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Stack spacing={1}>
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

        <EwayBillInfoPanel
          eway={voucherEwayBill}
          onEdit={
            mode === 'view' && editVoucherId
              ? () => {
                  setEwayDetailsOnly(true);
                  setEwayDetailsOpen(true);
                }
              : undefined
          }
          onPrint={voucherEwayBill ? printEwayDetails : undefined}
        />

        <ActionFooter
          mode={mode}
          saving={saving}
          onCancel={() => navigate(listPath)}
          onSave={() => {
            void saveVoucher({ navigateAfter: false });
          }}
          onSaveAndClose={() => {
            void saveVoucher({ navigateAfter: true, redirectTo: listPath });
          }}
          onSaveAndPrint={() => {
            void (async () => {
              const saved = await saveVoucher({ navigateAfter: false });
              if (!saved) return;
              await runFormPrintAction('print');
              navigate(listPath);
            })();
          }}
          onSaveAndSend={() => setSendDialogOpen(true)}
          onEdit={() => setMode('edit')}
        />

        <EwayBillThresholdDialog
          open={ewayThresholdOpen}
          invoiceAmount={Number(totals.grandTotal || 0)}
          onAddEway={handleEwayAddDetails}
          onSkipSave={handleEwaySkipAndSave}
          onCancel={() => {
            setEwayThresholdOpen(false);
            setPendingSaveOptions(null);
          }}
          busy={saving}
        />

        <EwayBillDetailsModal
          open={ewayDetailsOpen}
          initialValues={ewayBillToFormValues(voucherEwayBill)}
          title={ewayDetailsOnly ? 'Edit E-Way Bill' : 'E-Way Bill Details'}
          onClose={() => {
            setEwayDetailsOpen(false);
            setEwayDetailsOnly(false);
          }}
          onSave={handleEwayDetailsSave}
          busy={saving}
        />

        <Dialog open={sendDialogOpen} onClose={() => setSendDialogOpen(false)}>
          <DialogTitle>Save & Send</DialogTitle>
          <DialogContent>
            <Stack spacing={1} sx={{ pt: 1, minWidth: 280 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  void (async () => {
                    const saved = await saveVoucher({ navigateAfter: false });
                    if (!saved) return;
                    await runFormPrintAction('whatsapp');
                    setSendDialogOpen(false);
                  })();
                }}
              >
                Send WhatsApp
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  void (async () => {
                    const saved = await saveVoucher({ navigateAfter: false });
                    if (!saved) return;
                    const email = partyDraft.billing.email?.trim();
                    if (email) window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Tax Invoice ${formState.number}`)}`;
                    else window.alert('Customer email is not set.');
                    setSendDialogOpen(false);
                  })();
                }}
              >
                Send Email
              </Button>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSendDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <PrintExportSetupDialog
          open={printSetup.open}
          action={printSetup.action}
          applyOnly={printSetup.applyOnly}
          confirmLabel={printSetup.applyOnly ? 'Apply' : undefined}
          onApply={(input) => setInvoiceTemplateOverride(input.templateId)}
          onClose={() => setPrintSetup((p) => ({ ...p, open: false, applyOnly: false }))}
          buildPackage={(input) => buildCurrentInvoiceHtml(input)}
          whatsAppMeta={{
            invoiceNumber: formState.number,
            invoiceDate: formState.date,
            grandTotal: Number(totals.grandTotal || 0),
            phone: partyDraft.billing.phone,
          }}
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
          initialBarcode={pendingScannedBarcode}
          onClose={() => {
            setShowQuickCreateItem(false);
            setPendingScannedBarcode('');
          }}
          onSaved={handleInventoryMasterSaved}
        />

        <ListPickerModal<Party>
          open={partyPickerOpen}
          onClose={() => {
            suppressNextPartyFocusOpenRef.current = true;
            setPartyPickerOpen(false);
          }}
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
            const nextPending = {
              partyId: selectedParty.id,
              ledgerId,
              name: selectedParty.name,
              gstin: selectedParty.gstin,
              address: selectedParty.address,
              phone: selectedParty.mobile,
              email: selectedParty.email,
              city: selectedParty.city,
              district: selectedParty.district,
              state: selectedParty.state,
              pin: selectedParty.pincode,
            };
            setPendingCustomerDetails(nextPending);
            // Open confirm popup after picker close animation so it reliably appears.
            window.setTimeout(() => {
              setCustomerConfirmOpen(true);
            }, 80);
          }}
          onCreateNew={() => {
            setPartyPickerOpen(false);
            setShowQuickCreateCustomer(true);
          }}
          createNewLabel="+ Create New Party"
          emptyMessage="No parties found."
        />

        <ListPickerModal<InventoryItem>
          sessionKey={itemPickerLineId}
          open={itemPickerLineId !== null}
          onClose={() => {
            suppressNextItemFocusOpenRef.current = true;
            setItemPickerLineId(null);
            setItemPickerInitialQuery('');
          }}
          title="List of Inventory Items"
          searchPlaceholder="Search item name, SKU, or barcode…"
          initialQuery={itemPickerInitialQuery}
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
              id: 'unit',
              header: 'Unit',
              width: 72,
              render: (it) => (
                <Typography variant="body2">
                  {unitLabelById.get(it.unitId) ?? it.unitId ?? '—'}
                </Typography>
              ),
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
            setItemPickerInitialQuery('');
            suppressNextItemFocusOpenRef.current = true;
            setItemPickerLineId(null);
            window.setTimeout(() => {
              focusRegistry.focusById(buildLineFieldId(lid, 'quantity'));
            }, 0);
          }}
          onCreateNew={() => {
            setItemPickerLineId(null);
            setItemPickerInitialQuery('');
            setPendingScannedBarcode('');
            setShowQuickCreateItem(true);
          }}
          createNewLabel="+ Create New Item"
          emptyMessage="No items found."
        />

        <Dialog
          open={customerConfirmOpen}
          onClose={() => {
            setCustomerConfirmOpen(false);
            setPendingCustomerDetails(null);
          }}
          maxWidth="sm"
          fullWidth
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setCustomerConfirmOpen(false);
              setPendingCustomerDetails(null);
              return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
              e.preventDefault();
              applyConfirmedCustomer();
            }
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>Confirm Customer Details</DialogTitle>
          <DialogContent sx={{ pt: '8px !important' }}>
            <Stack spacing={1.25}>
              <Typography variant="body2" color="text.secondary">
                Customer select ho gaya. Details verify karo, phir items entry continue hogi.
              </Typography>
              <TextField
                label="Customer Name"
                size="small"
                value={pendingCustomerDetails?.name || ''}
                onChange={(e) =>
                  setPendingCustomerDetails((prev) => ({ ...(prev || {}), name: e.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Address"
                size="small"
                value={pendingCustomerDetails?.address || ''}
                onChange={(e) =>
                  setPendingCustomerDetails((prev) => ({ ...(prev || {}), address: e.target.value }))
                }
                required
                error={!String(pendingCustomerDetails?.address || '').trim()}
                helperText={!String(pendingCustomerDetails?.address || '').trim() ? 'Address is mandatory' : ''}
                fullWidth
              />
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="GSTIN"
                    size="small"
                    value={pendingCustomerDetails?.gstin || ''}
                    onChange={(e) =>
                      setPendingCustomerDetails((prev) => ({ ...(prev || {}), gstin: e.target.value }))
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Phone"
                    size="small"
                    value={pendingCustomerDetails?.phone || ''}
                    onChange={(e) =>
                      setPendingCustomerDetails((prev) => ({ ...(prev || {}), phone: e.target.value }))
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <PincodeTextField
                    label="Pincode"
                    size="small"
                    value={pendingCustomerDetails?.pin || ''}
                    onPinChange={(pin) =>
                      setPendingCustomerDetails((prev) => ({ ...(prev || {}), pin }))
                    }
                    autofill={customerPinAutofill}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="City"
                    size="small"
                    value={pendingCustomerDetails?.city || ''}
                    onChange={(e) => {
                      customerPinAutofill.clearHighlight('city');
                      setPendingCustomerDetails((prev) => ({ ...(prev || {}), city: e.target.value }));
                    }}
                    sx={customerPinAutofill.fieldSx('city')}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="District"
                    size="small"
                    value={pendingCustomerDetails?.district || ''}
                    onChange={(e) => {
                      customerPinAutofill.clearHighlight('district');
                      setPendingCustomerDetails((prev) => ({ ...(prev || {}), district: e.target.value }));
                    }}
                    sx={customerPinAutofill.fieldSx('district')}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="State"
                    size="small"
                    value={pendingCustomerDetails?.state || ''}
                    onChange={(e) => {
                      customerPinAutofill.clearHighlight('state');
                      setPendingCustomerDetails((prev) => ({ ...(prev || {}), state: e.target.value }));
                    }}
                    sx={customerPinAutofill.fieldSx('state')}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => {
                setCustomerConfirmOpen(false);
                setPendingCustomerDetails(null);
              }}
            >
              Cancel (Esc)
            </Button>
            <Button
              variant="contained"
              onClick={applyConfirmedCustomer}
              disabled={!String(pendingCustomerDetails?.address || '').trim()}
              sx={erpContainedButtonSx}
            >
              Accept & Continue (Ctrl+A)
            </Button>
          </DialogActions>
        </Dialog>
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
  onOpenItemPicker: (rowIndex: number, initialQuery?: string) => void;
  shouldOpenPickerOnItemFocus: () => boolean;
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
    shouldOpenPickerOnItemFocus,
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
      <TableRow hover>
        <TableCell sx={{ minWidth: 200 }}>
          <Stack spacing={0.5}>
            <TextField
              value={line.itemId ? getItemDisplayName(line.itemId) : ''}
              placeholder="Click to search items"
              fullWidth
              size="small"
              InputProps={{ readOnly: true }}
              inputRef={itemFieldRef}
              onClick={() => onOpenItemPicker(index)}
              onFocus={() => {
                if (!shouldOpenPickerOnItemFocus()) return;
                onOpenItemPicker(index);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
                  return;
                }
                if (e.key.length === 1) {
                  e.preventDefault();
                  onOpenItemPicker(index, e.key);
                  return;
                }
                if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ') {
                  e.preventDefault();
                  onOpenItemPicker(index);
                }
              }}
              inputProps={{ 'aria-haspopup': 'dialog' as const }}
            />
            {line.appliedSchemeId ? (
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  label={`Scheme: ${line.appliedSchemeLabel || 'Applied'}`}
                />
                {(line.freeQuantity || 0) > 0 ? (
                  <Chip size="small" color="info" variant="outlined" label={`Free Qty: ${line.freeQuantity}`} />
                ) : null}
              </Stack>
            ) : null}
          </Stack>
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
        <TableCell sx={{ minWidth: 280, width: 280 }}>
          <Stack spacing={1}>
            {line.autoRateInclusive ? (
              <Typography variant="caption" color="text.secondary">
                Auto price: ₹{line.autoRateInclusive}
                {line.priceOverridden ? ` · Manual override: ₹${line.rateInclusive || line.rateExclusive}` : ''}
              </Typography>
            ) : null}
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
              helperText="Primary entry"
              size="small"
              fullWidth
            />
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
          </Stack>
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
