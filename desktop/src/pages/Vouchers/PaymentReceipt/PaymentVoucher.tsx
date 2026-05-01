import { useState, useEffect, useMemo } from 'react';
import { 
  Alert, 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Grid, 
  Stack, 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableRow, 
  TextField, 
  Typography, 
  Autocomplete, 
  IconButton, 
  Tabs, 
  Tab,
  Paper,
  Divider,
  Avatar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PersonIcon from '@mui/icons-material/Person';
import dayjs from 'dayjs';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { voucherService } from '../../../services/vouchers/voucherService';
import { usePermission } from '../../../hooks/usePermission';
import { autoLedgerService } from '../../../services/masters/autoLedgerService';
import { ledgerAccountService } from '../../../services/masters/ledgerAccountService';
import { ledgerGroupService } from '../../../services/masters/ledgerGroupService';
import type { LedgerAccount } from '../../../types/masters';
import { fetchOutstandingInvoices, type OutstandingInvoice } from '../../../services/payments/paymentService';
import { 
  ledgerTouchesExpenseTree, 
  ledgerTouchesIncomeTree, 
  particularRole 
} from '../../../utils/expenseLedgerGrouping';

export type PaymentReceiptVoucherPageProps = {
  /**
   * When true, Particulars includes expense ledgers (e.g. Direct / Indirect expense heads) for Dr on payments.
   * Used by Manual Expense entry; default Payments page stays party-only.
   */
  includeExpenseLedgersInParticulars?: boolean;
  /** When true, no outer MUI Card — for nesting inside Expenses page section. */
  embedded?: boolean;
  /** Initial voucher type: PAYMENT or RECEIPT */
  initialType?: 'PAYMENT' | 'RECEIPT';
  /** Dedicated minimal full-screen entry mode (Tally-like). */
  fullScreenMode?: boolean;
  /** When true, show modern card-heavy layout even for /new route. */
  forceModernView?: boolean;
};

const PaymentReceiptVoucherPage = ({
  includeExpenseLedgersInParticulars = false,
  embedded = false,
  initialType = 'PAYMENT',
  fullScreenMode = false,
  forceModernView = false,
}: PaymentReceiptVoucherPageProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editVoucherId } = useParams<{ id: string }>();
  const stateVoucherId = String((location.state as { voucherId?: string } | null)?.voucherId ?? '').trim();
  const pathMatch = String(location.pathname).match(/\/vouchers\/(?:payment|receipt)-vouchers\/([^/]+)\/edit$/i);
  const derivedEditVoucherId = editVoucherId || stateVoucherId || (pathMatch?.[1] ?? '');
  const isEditMode = Boolean(derivedEditVoucherId);
  const { can } = usePermission();
  const canCreate = can('create-vouchers');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [voucherType, setVoucherType] = useState<'PAYMENT' | 'RECEIPT'>(initialType);

  // Form state
  const [formState, setFormState] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    number: `PAY-${dayjs().format('YYYYMMDD-HHmmss')}`,
    narration: '',
  });

  // Payment entries (multiple rows)
  const [paymentEntries, setPaymentEntries] = useState<Array<{
    id: number;
    account: any | null;
    particular: any | null;
    amount: string;
    debit: number;
    credit: number;
  }>>([
    { id: 1, account: null, particular: null, amount: '', debit: 0, credit: 0 }
  ]);

  // Available accounts (Cash + Bank)
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);

  const [defaultAccount, setDefaultAccount] = useState<any | null>(null);

  // Particulars: party ledgers; optionally + expense heads (manual expense screen)
  const [availableParticulars, setAvailableParticulars] = useState<LedgerAccount[]>([]);
  const [allLedgers, setAllLedgers] = useState<LedgerAccount[]>([]);
  const [particularGroupById, setParticularGroupById] = useState<Map<string, { type: string; parentGroupId?: string | null }>>(new Map());
  const [editHydrated, setEditHydrated] = useState(false);

  const [pendingInvoicesLoading, setPendingInvoicesLoading] = useState(false);
  const [pendingInvoicesError, setPendingInvoicesError] = useState<string | null>(null);
  const [pendingInvoices, setPendingInvoices] = useState<OutstandingInvoice[]>([]);

  // Load accounts and particulars
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Ensure core ledgers exist first
        await autoLedgerService.ensureCore();
        
        // Get all ledgers
        const ledgers = await ledgerAccountService.list({ includeInactive: false });
        
        setAllLedgers(ledgers);

        // Create default cash/bank accounts if none exist
        let cashBankLedgers = ledgers.filter(
          (ledger) =>
            ledger.isCashBank ||
            ledger.groupId === 'grp-cash-in-hand' ||
            ledger.groupId === 'grp-bank-accounts' ||
            ledger.groupId === 'grp-cash-bank'
        );
        
        if (cashBankLedgers.length === 0) {
          // Try to get the cash ledger again after ensuring core
          const updatedLedgers = await ledgerAccountService.list({ includeInactive: false });
          cashBankLedgers = updatedLedgers.filter(
            (ledger) =>
              ledger.isCashBank ||
              ledger.groupId === 'grp-cash-in-hand' ||
              ledger.groupId === 'grp-bank-accounts' ||
              ledger.groupId === 'grp-cash-bank'
          );
        }
        
        setAvailableAccounts(cashBankLedgers);

        const preferredCash =
          cashBankLedgers.find((l: any) => String(l.id).toLowerCase() === 'led-cash') ??
          cashBankLedgers.find((l: any) => String(l.name ?? '').toLowerCase().trim() === 'cash') ??
          cashBankLedgers[0] ??
          null;

        setDefaultAccount(preferredCash);

        // Preselect cash for the first row (so user can directly pick Party/Expense next).
        setPaymentEntries((prev) =>
          prev.map((e) => (e.id === 1 && (e.account === null || e.account === undefined) ? { ...e, account: preferredCash } : e))
        );

        // Filter for Customer and Supplier ledgers only for Particulars field
        let customerSupplierLedgers = ledgers.filter(ledger => {
          // Check if ledger belongs to Sundry Debtors (Customers) or Sundry Creditors (Suppliers) groups
          return ledger.groupId === 'grp-sundry-debtors' || ledger.groupId === 'grp-sundry-creditors';
        });

        // If no customers or suppliers exist, create some sample ones
        if (customerSupplierLedgers.length === 0) {
          try {
            // Create sample customer
            await autoLedgerService.ensureCustomerLedger('Sample Customer');
            // Create sample supplier
            await autoLedgerService.ensureSupplierLedger('Sample Supplier');
            
            // Reload ledgers to get the newly created ones
            const updatedLedgers = await ledgerAccountService.list({ includeInactive: false });
            customerSupplierLedgers = updatedLedgers.filter(ledger => {
              return ledger.groupId === 'grp-sundry-debtors' || ledger.groupId === 'grp-sundry-creditors';
            });
          } catch (createError) {
            console.error('Failed to create sample customers/suppliers:', createError);
          }
        }

        let particularsList = customerSupplierLedgers;

        let gMap = new Map<string, { type: string; parentGroupId?: string | null }>();
        try {
          const groups = await ledgerGroupService.list({ includeInactive: false });
          gMap = new Map(groups.map((g) => [g.id, { type: g.type, parentGroupId: g.parentGroupId }]));
        } catch (groupErr) {
          console.warn('[PaymentVoucher] ledger groups load failed', groupErr);
        }
        setParticularGroupById(gMap);

        if (includeExpenseLedgersInParticulars) {
          const expenseLedgers = ledgers.filter(
            (l) => !l.isCashBank && ledgerTouchesExpenseTree(l.groupId, gMap)
          );
          const incomeLedgers = ledgers.filter(
            (l) => !l.isCashBank && ledgerTouchesIncomeTree(l.groupId, gMap)
          );
          const byId = new Map<string, LedgerAccount>();
          for (const l of [...particularsList, ...expenseLedgers, ...incomeLedgers]) {
            byId.set(l.id, l);
          }
          particularsList = [...byId.values()].sort((a, b) =>
            (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
          );
        }

        setAvailableParticulars(particularsList);
        
        // If still no accounts, show a helpful error
        if (cashBankLedgers.length === 0 && ledgers.length === 0) {
          setError('No ledger accounts found. Please create some accounts first.');
        }
        
      } catch (error) {
        console.error('Failed to load ledgers:', error);
        const msg = error instanceof Error ? error.message : String(error);
        setError(msg ? `Failed to load accounts: ${msg}` : 'Failed to load accounts. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [includeExpenseLedgersInParticulars]);

  useEffect(() => {
    setEditHydrated(false);
  }, [derivedEditVoucherId]);

  useEffect(() => {
    if (!isEditMode || editHydrated || allLedgers.length === 0) return;

    (async () => {
      const existing = derivedEditVoucherId ? await voucherService.getById(derivedEditVoucherId) : null;
      if (!existing) {
        setError('Voucher not found for edit');
        return;
      }
      if (existing.type !== voucherType) {
        setError(`This is a ${existing.type} voucher. Open from correct list.`);
        return;
      }

      const toObj = (ledgerId: string) => allLedgers.find((l) => l.id === ledgerId) ?? null;
      const isCashLikeLedger = (ledger: LedgerAccount | null) =>
        Boolean(
          ledger &&
            (ledger.isCashBank ||
              ledger.groupId === 'grp-cash-in-hand' ||
              ledger.groupId === 'grp-bank-accounts' ||
              ledger.groupId === 'grp-cash-bank')
        );
      const cashLines = existing.lines.filter((line) => {
        const ledger = toObj(line.ledgerId);
        return isCashLikeLedger(ledger);
      });
      const otherLines = existing.lines.filter((line) => {
        const ledger = toObj(line.ledgerId);
        return !isCashLikeLedger(ledger);
      });
      const rowCount = Math.max(cashLines.length, otherLines.length, 1);
      const nextRows = Array.from({ length: rowCount }).map((_, idx) => {
        const a = cashLines[idx];
        const p = otherLines[idx];
        const amount =
          voucherType === 'PAYMENT'
            ? Number(p?.debit ?? a?.credit ?? 0)
            : Number(a?.debit ?? p?.credit ?? 0);
        return {
          id: idx + 1,
          account: toObj(a?.ledgerId ?? '') ?? null,
          particular: toObj(p?.ledgerId ?? '') ?? null,
          amount: amount > 0 ? String(amount) : '',
          debit: voucherType === 'PAYMENT' ? Number(p?.debit ?? 0) : Number(a?.debit ?? 0),
          credit: voucherType === 'PAYMENT' ? Number(a?.credit ?? 0) : Number(p?.credit ?? 0),
        };
      });

      setFormState({
        date: dayjs(existing.date).isValid() ? dayjs(existing.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        number: existing.number,
        narration: String(existing.narration ?? ''),
      });
      setPaymentEntries(nextRows);
      setEditHydrated(true);
    })().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load voucher'));
  }, [isEditMode, editHydrated, allLedgers, derivedEditVoucherId, voucherType]);

  // Update voucher number when type changes
  useEffect(() => {
    const prefix = voucherType === 'RECEIPT' ? 'REC' : 'PAY';
    const newNumber = `${prefix}-${dayjs().format('YYYYMMDD-HHmmss')}`;
    setFormState(prev => ({ ...prev, number: newNumber }));
  }, [voucherType]);

  useEffect(() => {
    const queryType = new URLSearchParams(location.search).get('type');
    const nextType = String(queryType || '').toUpperCase();
    if (nextType === 'PAYMENT' || nextType === 'RECEIPT') {
      setVoucherType(nextType);
    }
  }, [location.search]);

  useEffect(() => {
    if (!fullScreenMode || forceModernView) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        navigate(voucherType === 'RECEIPT' ? '/vouchers/receipt-vouchers' : '/vouchers/payment-vouchers');
        return;
      }
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.getAttribute('role') === 'combobox')) {
        return;
      }
      const root = target.closest('form');
      if (!root) return;
      const selectors = 'input:not([disabled]), textarea:not([disabled]), [role="combobox"]';
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(selectors)).filter((el) => el.offsetParent !== null);
      const idx = focusables.indexOf(target);
      if (idx < 0) return;
      e.preventDefault();
      const next = focusables[idx + 1];
      if (next) {
        next.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [fullScreenMode, forceModernView, navigate, voucherType]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalDebit = paymentEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredit = paymentEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    return { totalDebit, totalCredit, balanced: totalDebit === totalCredit };
  }, [paymentEntries]);

  const totalPaymentAmount = useMemo(
    () => paymentEntries.reduce((sum, e) => sum + (parseFloat(String(e.amount ?? '')) || 0), 0),
    [paymentEntries]
  );

  const overdueInvoices = useMemo(
    () => pendingInvoices.filter((inv) => Number(inv.overdueDays ?? 0) > 0),
    [pendingInvoices]
  );

  useEffect(() => {
    let cancelled = false;

    const billWiseEligible = paymentEntries.length > 0 && paymentEntries.every((entry) => {
      if (!entry.particular) return false;
      return !!partyTypeFromParticular(entry.particular);
    });

    // Clear allocation if not eligible (e.g. expense-ledger particulars)
    if (!billWiseEligible) {
      setPendingInvoices([]);
      setPendingInvoicesError(null);
      setPendingInvoicesLoading(false);
      return;
    }

    const rowsWithAmount = paymentEntries
      .map((entry) => {
        const amt = parseFloat(String(entry.amount ?? '')) || 0;
        return { entry, amt };
      })
      .filter(({ amt }) => amt > 0);

    if (rowsWithAmount.length === 0) {
      setPendingInvoices([]);
      setPendingInvoicesError(null);
      setPendingInvoicesLoading(false);
      return;
    }

    const byParty = new Map<string, { partyType: 'CUSTOMER' | 'SUPPLIER'; partyLedgerId: string; amount: number }>();
    for (const { entry, amt } of rowsWithAmount) {
      const partyLedgerId = String(entry.particular?.id ?? '');
      const partyType = partyTypeFromParticular(entry.particular);
      if (!partyLedgerId || !partyType) continue;
      const existing = byParty.get(partyLedgerId);
      if (existing) existing.amount += amt;
      else byParty.set(partyLedgerId, { partyType, partyLedgerId, amount: amt });
    }

    if (byParty.size === 0) {
      setPendingInvoices([]);
      setPendingInvoicesError(null);
      setPendingInvoicesLoading(false);
      return;
    }

    setPendingInvoicesLoading(true);
    setPendingInvoicesError(null);

    (async () => {
      try {
        const invMap = new Map<string, OutstandingInvoice>();
        for (const [, grp] of byParty) {
          const invoices = await fetchOutstandingInvoices(String(grp.partyLedgerId), grp.partyType);
          if (cancelled) return;

          let remaining = grp.amount;
          const allocated = (invoices ?? []).map((inv) => {
            const balance = Number(inv.balanceAmount ?? 0) || 0;
            const alloc = Math.max(0, Math.min(balance, remaining));
            remaining -= alloc;
            return {
              ...inv,
              isSelected: alloc > 0,
              paymentAmount: alloc,
            };
          });

          for (const inv of allocated) {
            const key = String(inv.id ?? inv.number);
            const existing = invMap.get(key);
            if (existing) {
              invMap.set(key, { ...existing, paymentAmount: (Number(existing.paymentAmount ?? 0) || 0) + (Number(inv.paymentAmount ?? 0) || 0) });
            } else {
              invMap.set(key, inv);
            }
          }
        }

        setPendingInvoices(Array.from(invMap.values()));
        // Do not block voucher save when amount is more than bill-wise invoices.
        // This can happen for opening-balance dues or advance adjustments where no invoice exists.
        setPendingInvoicesError(null);
      } catch (e: any) {
        if (cancelled) return;
        setPendingInvoices([]);
        setPendingInvoicesError(e?.message ?? 'Failed to load pending invoices');
      } finally {
        if (!cancelled) setPendingInvoicesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paymentEntries, voucherType]);

  /** Filter particulars based on voucher type. */
  const particularsOptions = useMemo(() => {
    if (!includeExpenseLedgersInParticulars) return availableParticulars;
    
    if (voucherType === 'RECEIPT') {
      // For Receipts: Show Customers, Suppliers, and Income ledgers
      return availableParticulars.filter(
        (l) => 
          l.groupId === 'grp-sundry-debtors' || 
          l.groupId === 'grp-sundry-creditors' || 
          ledgerTouchesIncomeTree(l.groupId, particularGroupById)
      );
    } else {
      // For Payments: Show Customers, Suppliers, and Expense ledgers
      return availableParticulars.filter(
        (l) => 
          l.groupId === 'grp-sundry-debtors' || 
          l.groupId === 'grp-sundry-creditors' || 
          ledgerTouchesExpenseTree(l.groupId, particularGroupById)
      );
    }
  }, [availableParticulars, voucherType, includeExpenseLedgersInParticulars, particularGroupById]);

  // Add new payment row
  const addPaymentRow = () => {
    const newId = Math.max(...paymentEntries.map(e => e.id)) + 1;
    setPaymentEntries([...paymentEntries, { 
      id: newId, 
      account: defaultAccount, 
      particular: null, 
      amount: '', 
      debit: 0, 
      credit: 0 
    }]);
  };

  // Remove payment row
  const removePaymentRow = (id: number) => {
    if (paymentEntries.length > 1) {
      setPaymentEntries(paymentEntries.filter(entry => entry.id !== id));
    }
  };

  // Update payment entry
  const updatePaymentEntry = (id: number, field: string, value: any) => {
    setPaymentEntries(entries => entries.map(entry => {
      if (entry.id === id) {
        const updated = { ...entry, [field]: value };

        const amount = parseFloat(String(updated.amount ?? '')) || 0;

        if (voucherType === 'PAYMENT') {
          // PAYMENT: Account (Cash/Bank) = Credit, Particulars (Party/Expense) = Debit
          updated.credit = updated.account ? amount : 0;
          updated.debit = updated.particular ? amount : 0;
        } else {
          // RECEIPT: Account (Cash/Bank) = Debit, Particulars (Party/Income) = Credit
          updated.debit = updated.account ? amount : 0;
          updated.credit = updated.particular ? amount : 0;
        }

        if (amount <= 0) {
          updated.debit = 0;
          updated.credit = 0;
        }

        return updated;
      }
      return entry;
    }));
  };

  // Auto-balance when account or particular changes
  const handleAccountChange = (id: number, account: any) => {
    updatePaymentEntry(id, 'account', account);
  };

  const handleParticularChange = (id: number, particular: any) => {
    updatePaymentEntry(id, 'particular', particular);
  };

  // Handle voucher type change
  const handleVoucherTypeChange = (_event: React.SyntheticEvent, newValue: 'PAYMENT' | 'RECEIPT') => {
    setVoucherType(newValue);
    // Reset entries when type changes
    setPendingInvoices([]);
    setPendingInvoicesError(null);
    setPaymentEntries([{ id: 1, account: defaultAccount, particular: null, amount: '', debit: 0, credit: 0 }]);
  };

  const partyTypeFromParticular = (ledger: any): 'CUSTOMER' | 'SUPPLIER' | null => {
    const gid = String(ledger?.groupId ?? '');
    if (gid === 'grp-sundry-debtors') return 'CUSTOMER';
    if (gid === 'grp-sundry-creditors') return 'SUPPLIER';
    return null;
  };

  const outstandingLabel = (ledger: any): string | null => {
    if (!ledger) return null;
    const partyType = partyTypeFromParticular(ledger);
    if (!partyType) return null;
    const raw = Number(ledger.currentBalance ?? 0);
    const amount = Math.abs(raw);
    const side = raw >= 0 ? 'Dr' : 'Cr';
    return `Outstanding: ₹${amount.toLocaleString('en-IN')} ${side}`;
  };

  const projectedOutstandingLabel = (entry: { particular: any | null; amount: string }): string | null => {
    if (!entry.particular) return null;
    const partyType = partyTypeFromParticular(entry.particular);
    if (!partyType) return null;
    const current = Number(entry.particular.currentBalance ?? 0);
    const amt = parseFloat(String(entry.amount ?? '')) || 0;
    const delta = voucherType === 'RECEIPT' ? -amt : amt;
    const projected = current + delta;
    const side = projected >= 0 ? 'Dr' : 'Cr';
    return `After entry: ₹${Math.abs(projected).toLocaleString('en-IN')} ${side}`;
  };

  // Validate form
  const canSubmit = canCreate && 
    formState.date && 
    formState.number && 
    totals.balanced && 
    totals.totalDebit > 0 && 
    !saving &&
    paymentEntries.every((entry) => {
      const amt = parseFloat(String(entry.amount ?? '')) || 0;
      return entry.account !== null && entry.particular !== null && amt > 0;
    }) &&
    (() => {
      const billWiseEligible = paymentEntries.every((entry) => {
        const p = entry.particular;
        if (!p) return false;
        return !!partyTypeFromParticular(p);
      });
      return billWiseEligible ? (!pendingInvoicesLoading && !pendingInvoicesError) : true;
    })();

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!canSubmit) {
      setError('Please complete all required fields and ensure debits equal credits.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Build voucher lines
      const voucherLines: any[] = [];
      
      paymentEntries.forEach(entry => {
        if (entry.account && typeof entry.account === 'object' && entry.account.id) {
          if (voucherType === 'PAYMENT' && entry.credit > 0) {
            // Payment: Credit line (Account - Cash/Bank)
            voucherLines.push({
              ledgerId: entry.account.id,
              debit: 0,
              credit: entry.credit,
            });
          } else if (voucherType === 'RECEIPT' && entry.debit > 0) {
            // Receipt: Debit line (Account - Cash/Bank)
            voucherLines.push({
              ledgerId: entry.account.id,
              debit: entry.debit,
              credit: 0,
            });
          }
        }
        
        if (entry.particular && typeof entry.particular === 'object' && entry.particular.id) {
          if (voucherType === 'PAYMENT' && entry.debit > 0) {
            // Payment: Debit line (Particular - Party/Expense)
            voucherLines.push({
              ledgerId: entry.particular.id,
              debit: entry.debit,
              credit: 0,
            });
          } else if (voucherType === 'RECEIPT' && entry.credit > 0) {
            // Receipt: Credit line (Particular - Party/Income)
            voucherLines.push({
              ledgerId: entry.particular.id,
              debit: 0,
              credit: entry.credit,
            });
          }
        }
      });

      const invoiceAllocTokens = pendingInvoices
        .filter((inv) => Number(inv.paymentAmount ?? 0) > 0)
        .map((inv) => `INVALLOC[${inv.number}]=${Number(inv.paymentAmount ?? 0).toFixed(2)}`);

      const narrationFinal = invoiceAllocTokens.length
        ? `${formState.narration ? String(formState.narration).trim() + ' ' : ''}${invoiceAllocTokens.join('; ')}`
        : formState.narration;

      // Create voucher
      const voucher = {
        type: voucherType,
        number: formState.number,
        date: formState.date,
        narration: narrationFinal,
        lines: voucherLines,
        status: 'ACTIVE' as const,
      };

      if (isEditMode && derivedEditVoucherId) {
        await voucherService.update(derivedEditVoucherId, voucher);
      } else {
        await voucherService.create(voucher);
      }
      
      // Reset form
      setFormState({
        date: dayjs().format('YYYY-MM-DD'),
        number: `${voucherType === 'RECEIPT' ? 'REC' : 'PAY'}-${dayjs().format('YYYYMMDD-HHmmss')}`,
        narration: '',
      });
      
      const refreshedLedgers = await ledgerAccountService.list({ includeInactive: false });
      const refreshedCash = refreshedLedgers.filter(
        (ledger) =>
          ledger.isCashBank ||
          ledger.groupId === 'grp-cash-in-hand' ||
          ledger.groupId === 'grp-bank-accounts' ||
          ledger.groupId === 'grp-cash-bank'
      );
      setAvailableAccounts(refreshedCash);
      const nextDefaultAccount =
        refreshedCash.find((l: any) => String(l.id).toLowerCase() === 'led-cash') ??
        refreshedCash.find((l: any) => String(l.name ?? '').toLowerCase().trim() === 'cash') ??
        refreshedCash[0] ??
        null;
      setDefaultAccount(nextDefaultAccount);
      setAvailableParticulars(
        refreshedLedgers.filter((ledger) => ledger.groupId === 'grp-sundry-debtors' || ledger.groupId === 'grp-sundry-creditors')
      );
      setPaymentEntries([{ id: 1, account: nextDefaultAccount, particular: null, amount: '', debit: 0, credit: 0 }]);
      setPendingInvoices([]);
      setPendingInvoicesError(null);
      setPendingInvoicesLoading(false);
      if (isEditMode) {
        navigate(voucherType === 'RECEIPT' ? '/vouchers/receipt-vouchers' : '/vouchers/payment-vouchers');
      }

    } catch (err) {
      setError('Failed to save voucher. Please try again.');
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const formBody = (
    <Stack spacing={4} sx={{ pb: 8 }}>
      {/* Header with modern look */}
      <Box sx={{ 
        p: 3, 
        borderRadius: 4, 
        background: voucherType === 'RECEIPT' 
          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
          : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        color: 'white',
        boxShadow: '0 4px 20px -5px rgba(0,0,0,0.2)'
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" fontWeight={800}>
              {isEditMode
                ? voucherType === 'RECEIPT'
                  ? 'Edit Receipt Voucher'
                  : 'Edit Payment Voucher'
                : voucherType === 'RECEIPT'
                ? 'Receipt Voucher'
                : 'Payment Voucher'}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              {voucherType === 'RECEIPT' 
                ? 'Record money coming in'
                : 'Record money going out'
              }
            </Typography>
          </Box>
          <Avatar sx={{ 
            width: 64, 
            height: 64, 
            bgcolor: 'rgba(255,255,255,0.2)', 
            backdropFilter: 'blur(10px)' 
          }}>
            {voucherType === 'RECEIPT' ? <ArrowDownwardIcon fontSize="large" /> : <ArrowUpwardIcon fontSize="large" />}
          </Avatar>
        </Stack>
      </Box>

      {/* Voucher Type Selection */}
      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', p: 1, borderRadius: 3 }}>
        <Tabs 
          value={voucherType} 
          onChange={handleVoucherTypeChange}
          sx={{
            '& .MuiTabs-indicator': { height: 4, borderRadius: 2 },
            '& .MuiTab-root': { fontWeight: 700, fontSize: '1rem' }
          }}
        >
          <Tab value="PAYMENT" label="Payment (Money Out)" icon={<ArrowUpwardIcon />} iconPosition="start" />
          <Tab value="RECEIPT" label="Receipt (Money In)" icon={<ArrowDownwardIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {error && (
        <Alert severity="error" variant="filled" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      {/* Basic Info Section */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <TextField
            label="Voucher Date"
            type="date"
            value={formState.date}
            onChange={(e) => setFormState(prev => ({ ...prev, date: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={{ '& .MuiInputBase-root': { height: 56 } }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="Voucher Number"
            value={formState.number}
            onChange={(e) => setFormState(prev => ({ ...prev, number: e.target.value }))}
            fullWidth
            sx={{ '& .MuiInputBase-root': { height: 56, fontWeight: 700 } }}
          />
        </Grid>
      </Grid>

      {/* Entries Section */}
      <Card variant="outlined" sx={{ overflow: 'visible' }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 3, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
            <Typography variant="h6" fontWeight={700}>
              Transaction Details
            </Typography>
          </Box>
          
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 800, py: 2 }}>Account (Bank/Cash)</TableCell>
                <TableCell sx={{ fontWeight: 800, py: 2 }}>Particulars (Party/Expense)</TableCell>
                <TableCell sx={{ fontWeight: 800, py: 2 }}>Amount (₹)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main', py: 2 }}>Debit (Dr)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, color: 'error.main', py: 2 }}>Credit (Cr)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, py: 2 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paymentEntries.map((entry) => (
                <TableRow key={entry.id} hover sx={{ '&:last-child td': { border: 0 }, verticalAlign: 'top' }}>
                  <TableCell>
                    <Autocomplete
                      options={availableAccounts}
                      getOptionLabel={(option) => option.name ?? '—'}
                      value={entry.account}
                      onChange={(_, newValue) => handleAccountChange(entry.id, newValue)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select Bank/Cash"
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <AccountBalanceIcon sx={{ color: 'primary.main', mr: 1, opacity: 0.7 }} />
                            )
                          }}
                        />
                      )}
                    />
                    <Box sx={{ minHeight: 22, pt: 0.5 }}>
                      {entry.account && (
                        <Typography variant="caption" sx={{ ml: 5, color: 'success.main', fontWeight: 600, display: 'block' }}>
                          Balance: ₹{entry.account.currentBalance?.toLocaleString() ?? 0}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Autocomplete
                      options={particularsOptions}
                      getOptionLabel={(option) => option.name ?? '—'}
                      value={entry.particular}
                      onChange={(_, newValue) => handleParticularChange(entry.id, newValue)}
                      disabled={!entry.account}
                      renderOption={(props, option) => (
                        <li {...props} title={option.name ?? ''}>
                          {option.name ?? '—'}
                        </li>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select Party/Expense"
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <PersonIcon sx={{ color: 'secondary.main', mr: 1, opacity: 0.7 }} />
                            )
                          }}
                        />
                      )}
                    />
                    <Box sx={{ minHeight: 54, pt: 0.5 }}>
                      {entry.particular && (
                        <Stack sx={{ ml: 5 }} spacing={0.2}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            Type: {particularRole(entry.particular, particularGroupById)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {entry.particular.name}
                          </Typography>
                          {outstandingLabel(entry.particular) && (
                            <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 700 }}>
                              {outstandingLabel(entry.particular)}
                            </Typography>
                          )}
                        </Stack>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={entry.amount}
                      onChange={(e) => updatePaymentEntry(entry.id, 'amount', e.target.value)}
                      placeholder="0.00"
                      sx={{ 
                        '& .MuiInputBase-input': { fontWeight: 800, fontSize: '1.1rem' }
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body1" fontWeight={900} color="success.main">
                      {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body1" fontWeight={900} color="error.main">
                      {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <IconButton 
                        onClick={addPaymentRow} 
                        color="primary"
                        sx={{ bgcolor: 'primary.light', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                      >
                        <AddIcon />
                      </IconButton>
                      {paymentEntries.length > 1 && (
                        <IconButton 
                          onClick={() => removePaymentRow(entry.id)} 
                          color="error"
                          sx={{ bgcolor: 'error.light', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Enhanced Footer Summary */}
          <Box sx={{ p: 3, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <Grid container alignItems="center" spacing={4}>
              <Grid item xs={12} md={4}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    ROWS: {paymentEntries.length}
                  </Typography>
                  <Divider orientation="vertical" flexItem />
                  <Typography variant="body2" color={totals.balanced ? 'success.main' : 'error.main'} fontWeight={800}>
                    {totals.balanced ? '✓ STATUS: BALANCED' : '✗ STATUS: UNBALANCED'}
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} md={8}>
                <Stack direction="row" spacing={4} justifyContent="flex-end">
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>
                      TOTAL DEBIT
                    </Typography>
                    <Typography variant="h5" fontWeight={900} color="success.main">
                      ₹{totals.totalDebit.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>
                      TOTAL CREDIT
                    </Typography>
                    <Typography variant="h5" fontWeight={900} color="error.main">
                      ₹{totals.totalCredit.toLocaleString()}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Pending invoices & allocation */}
      {(pendingInvoicesLoading || pendingInvoices.length > 0 || !!pendingInvoicesError) && (
        <Box sx={{ mt: 2 }}>
          {pendingInvoicesLoading && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Loading pending invoices...
            </Alert>
          )}
          {!pendingInvoicesLoading && pendingInvoicesError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {pendingInvoicesError}
            </Alert>
          )}

          {!pendingInvoicesLoading && overdueInvoices.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {overdueInvoices
                .slice(0, 3)
                .map((inv) => `${inv.number} overdue by ${inv.overdueDays} days`)
                .join(' | ')}
              {overdueInvoices.length > 3 ? ` | +${overdueInvoices.length - 3} more overdue bill(s)` : ''}
            </Alert>
          )}

          {!pendingInvoicesLoading && pendingInvoices.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
                  Pending invoices (auto-distributed)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Payment amount: ₹{totalPaymentAmount.toLocaleString('en-IN')} / Allocated: ₹
                  {pendingInvoices.reduce((s, inv) => s + (Number(inv.paymentAmount ?? 0) || 0), 0).toLocaleString('en-IN')}
                </Typography>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Party</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Invoice</TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="right">
                        Balance
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="right">
                        Allocated
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>{inv.partyName}</TableCell>
                        <TableCell>{inv.number}</TableCell>
                        <TableCell align="right">₹{Number(inv.balanceAmount ?? 0).toLocaleString('en-IN')}</TableCell>
                        <TableCell align="right">
                          {Number(inv.paymentAmount ?? 0) > 0
                            ? `₹${Number(inv.paymentAmount ?? 0).toLocaleString('en-IN')}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* Narration with shadow */}
      <TextField
        label="Voucher Narration / Remarks"
        value={formState.narration}
        onChange={(e) => setFormState(prev => ({ ...prev, narration: e.target.value }))}
        fullWidth
        multiline
        rows={4}
        placeholder={`Brief description of this ${voucherType.toLowerCase()}...`}
        sx={{ bgcolor: 'white', borderRadius: 4 }}
      />

      {/* Final Actions */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 3,
          mt: 2,
          py: 1.5,
          px: 2,
          borderTop: '1px solid #e2e8f0',
          bgcolor: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate(-1)}
            sx={{
              justifySelf: 'start',
              minWidth: 128,
              px: 3,
              borderRadius: 2,
              border: '1.5px solid',
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={!canSubmit}
            sx={{
              justifySelf: 'end',
              minWidth: 176,
              px: 4,
              borderRadius: 2,
              fontSize: '1rem',
              py: 1.2,
              boxShadow: '0 8px 14px -4px rgba(37, 99, 235, 0.35)',
            }}
          >
            {saving ? 'Processing...' : voucherType === 'RECEIPT' ? 'Save Receipt' : 'Save Payment'}
          </Button>
        </Box>
      </Box>
    </Stack>
  );

  const fullScreenBody = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#dfe8ef',
        border: '1px solid #b9c9d8',
      }}
    >
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #b9c9d8', bgcolor: '#f4f8fb' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Typography variant="h6" fontWeight={700}>
            {voucherType === 'RECEIPT' ? 'Receipt Voucher Creation' : 'Payment Voucher Creation'}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button type="submit" size="small" variant="contained" disabled={!canSubmit}>
              {saving ? 'Saving...' : 'Accept'}
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #b9c9d8', bgcolor: '#e9f0f6' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Tabs value={voucherType} onChange={handleVoucherTypeChange} sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36 } }}>
            <Tab value="PAYMENT" label="Payment" />
            <Tab value="RECEIPT" label="Receipt" />
          </Tabs>
          <TextField
            size="small"
            label="Date"
            type="date"
            value={formState.date}
            onChange={(e) => setFormState((prev) => ({ ...prev, date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            label="No."
            value={formState.number}
            onChange={(e) => setFormState((prev) => ({ ...prev, number: e.target.value }))}
          />
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ m: 1 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
        <Table size="small" sx={{ bgcolor: '#f7fbff' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Account</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Particulars</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Dr</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Cr</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">+</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paymentEntries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Autocomplete
                    size="small"
                    options={availableAccounts}
                    getOptionLabel={(option) => option.name ?? '—'}
                    value={entry.account}
                    onChange={(_, newValue) => handleAccountChange(entry.id, newValue)}
                    renderInput={(params) => <TextField {...params} placeholder="Bank/Cash" />}
                  />
                </TableCell>
                <TableCell>
                  <Autocomplete
                    size="small"
                    options={particularsOptions}
                    getOptionLabel={(option) => option.name ?? '—'}
                    value={entry.particular}
                    onChange={(_, newValue) => handleParticularChange(entry.id, newValue)}
                    disabled={!entry.account}
                    renderInput={(params) => <TextField {...params} placeholder="Party/Expense" />}
                  />
                  {outstandingLabel(entry.particular) && (
                    <Typography variant="caption" sx={{ color: '#1f4e79', fontWeight: 700 }}>
                      {outstandingLabel(entry.particular)}
                    </Typography>
                  )}
                  {projectedOutstandingLabel(entry) && (
                    <Typography variant="caption" sx={{ color: '#0f766e', fontWeight: 700, ml: 0.5 }}>
                      {projectedOutstandingLabel(entry)}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={entry.amount}
                    onChange={(e) => updatePaymentEntry(entry.id, 'amount', e.target.value)}
                    placeholder="0.00"
                  />
                </TableCell>
                <TableCell align="right">{entry.debit > 0 ? entry.debit.toLocaleString('en-IN') : '—'}</TableCell>
                <TableCell align="right">{entry.credit > 0 ? entry.credit.toLocaleString('en-IN') : '—'}</TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={addPaymentRow}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid #b9c9d8', bgcolor: '#edf4fa' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" fontWeight={700} title="F2 parties, F3 sales, F4 purchase, F6 reports, Esc back">
            {totals.balanced ? 'STATUS: BALANCED' : 'STATUS: UNBALANCED'}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            Total Dr: ₹{totals.totalDebit.toLocaleString('en-IN')} | Total Cr: ₹{totals.totalCredit.toLocaleString('en-IN')}
          </Typography>
        </Stack>
        <TextField
          size="small"
          fullWidth
          label="Narration"
          value={formState.narration}
          onChange={(e) => setFormState((prev) => ({ ...prev, narration: e.target.value }))}
          placeholder="Narration (bottom anchored like Tally)"
        />
      </Box>
    </Box>
  );

  if (loading) {
    return embedded ? (
      <Box sx={{ py: 2 }}>
        <Typography>Loading accounts...</Typography>
      </Box>
    ) : (
      <Card>
        <CardContent>
          <Typography>Loading accounts...</Typography>
      </CardContent>
      </Card>
    );
  }

  if (embedded) {
    return (
      <Box component="form" onSubmit={handleSubmit}>
        {formBody}
      </Box>
    );
  }

  if (fullScreenMode && !forceModernView) {
    return (
      <Box component="form" onSubmit={handleSubmit} sx={{ height: 'calc(100vh - 170px)', minHeight: 560 }}>
        {fullScreenBody}
      </Box>
    );
  }

  return (
    <Card component="form" onSubmit={handleSubmit}>
      <CardContent>{formBody}</CardContent>
    </Card>
  );
};

export default PaymentReceiptVoucherPage;
