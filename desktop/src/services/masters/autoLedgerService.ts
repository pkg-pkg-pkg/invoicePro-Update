import { ledgerGroupService } from './ledgerGroupService';
import { ledgerAccountService } from './ledgerAccountService';
import { LedgerAccount, LedgerBalanceType, LedgerGroup } from '../../types/masters';
import { sanitizeString } from './storageHelpers';

const GROUPS = {
  sundryDebtors: { id: 'grp-sundry-debtors', name: 'Sundry Debtors', type: 'ASSET' as const },
  sundryCreditors: { id: 'grp-sundry-creditors', name: 'Sundry Creditors', type: 'LIABILITY' as const },
  sales: { id: 'grp-sales-accounts', name: 'Sales Accounts', type: 'INCOME' as const },
  purchase: { id: 'grp-purchase-accounts', name: 'Purchase Accounts', type: 'EXPENSE' as const },
  cashBank: { id: 'grp-cash-bank', name: 'Cash & Bank', type: 'ASSET' as const },
  dutiesTaxes: { id: 'grp-duties-taxes', name: 'Duties & Taxes', type: 'LIABILITY' as const },
};

/** Seeded chart group — same id as seedMasters / LedgerAccountForm */
const GROUP_CASH_IN_HAND_ID = 'grp-cash-in-hand';

const SYSTEM_LEDGERS = {
  cash: { id: 'led-cash', name: 'Cash', groupId: GROUP_CASH_IN_HAND_ID, isCashBank: true, openingBalanceType: 'DEBIT' as LedgerBalanceType },
  sales: { id: 'led-sales', name: 'GST Sales', groupId: GROUPS.sales.id, openingBalanceType: 'CREDIT' as LedgerBalanceType },
  purchase: { id: 'led-purchase', name: 'GST Purchase', groupId: GROUPS.purchase.id, openingBalanceType: 'DEBIT' as LedgerBalanceType },
  purchaseReturns: {
    id: 'led-purchase-returns',
    name: 'Purchase Returns',
    groupId: GROUPS.purchase.id,
    openingBalanceType: 'CREDIT' as LedgerBalanceType,
  },
  salesReturns: {
    id: 'led-sales-returns',
    name: 'Sales Returns',
    groupId: GROUPS.sales.id,
    openingBalanceType: 'DEBIT' as LedgerBalanceType,
  },
  gst: { id: 'led-gst-taxes', name: 'GST Taxes', groupId: GROUPS.dutiesTaxes.id, openingBalanceType: 'CREDIT' as LedgerBalanceType },
  cgstOutput: { id: 'led-cgst-output', name: 'CGST Output', groupId: GROUPS.dutiesTaxes.id, openingBalanceType: 'CREDIT' as LedgerBalanceType },
  sgstOutput: { id: 'led-sgst-output', name: 'SGST Output', groupId: GROUPS.dutiesTaxes.id, openingBalanceType: 'CREDIT' as LedgerBalanceType },
  igstOutput: { id: 'led-igst-output', name: 'IGST Output', groupId: GROUPS.dutiesTaxes.id, openingBalanceType: 'CREDIT' as LedgerBalanceType },
  cgstInput: { id: 'led-cgst-input', name: 'CGST Input', groupId: GROUPS.dutiesTaxes.id, openingBalanceType: 'DEBIT' as LedgerBalanceType },
  sgstInput: { id: 'led-sgst-input', name: 'SGST Input', groupId: GROUPS.dutiesTaxes.id, openingBalanceType: 'DEBIT' as LedgerBalanceType },
  igstInput: { id: 'led-igst-input', name: 'IGST Input', groupId: GROUPS.dutiesTaxes.id, openingBalanceType: 'DEBIT' as LedgerBalanceType },
  roundOff: { id: 'led-round-off', name: 'Round Off', groupId: GROUPS.dutiesTaxes.id, openingBalanceType: 'DEBIT' as LedgerBalanceType },
};

const findLedgerByName = (ledgers: LedgerAccount[], name: string) => {
  const target = name.trim().toLowerCase();
  return ledgers.find((l) => l.name.trim().toLowerCase() === target) ?? null;
};

const ensureGroups = async () => {
  // Hierarchy is seeded by seedMasters — only ensure missing legacy-compatible rows.
  await ledgerGroupService.seed([
    {
      ...GROUPS.sundryDebtors,
      code: 'SDEBT',
      parentGroupId: 'grp-current-assets',
      isSystem: true,
      sortOrder: 22,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      ...GROUPS.sundryCreditors,
      code: 'SCRED',
      parentGroupId: 'grp-current-liabilities',
      isSystem: true,
      sortOrder: 40,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      ...GROUPS.sales,
      code: 'SALES',
      parentGroupId: 'grp-direct-income',
      isSystem: true,
      sortOrder: 52,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      ...GROUPS.purchase,
      code: 'PUR',
      parentGroupId: 'grp-direct-expenses',
      isSystem: true,
      sortOrder: 62,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      ...GROUPS.dutiesTaxes,
      code: 'GST',
      parentGroupId: 'grp-current-liabilities',
      isSystem: true,
      sortOrder: 41,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
  ]);
};

const ensureSystemLedger = async (def: typeof SYSTEM_LEDGERS[keyof typeof SYSTEM_LEDGERS]) => {
  await ensureGroups();
  const ledgers = await ledgerAccountService.list({ includeInactive: true });
  const existingById = ledgers.find((l) => l.id === def.id);
  const existingByName = findLedgerByName(ledgers, def.name);
  const normalizeExisting = async (existing: LedgerAccount) => {
    const patch: Partial<LedgerAccount> = {};
    if (existing.name !== def.name) patch.name = def.name;
    if (existing.groupId !== def.groupId) patch.groupId = def.groupId;
    if (existing.isCashBank !== Boolean((def as any).isCashBank)) patch.isCashBank = Boolean((def as any).isCashBank);
    if (existing.isActive === false) patch.isActive = true;
    if (Object.keys(patch).length > 0) {
      try {
        await ledgerAccountService.update(existing.id, patch);
      } catch (e) {
        console.warn(`System ledger normalize failed for ${existing.id}`, e);
      }
    }
    return existing.id;
  };
  if (existingById) return normalizeExisting(existingById as LedgerAccount);
  if (existingByName) return normalizeExisting(existingByName as LedgerAccount);

  try {
    const created = await ledgerAccountService.create({
      id: def.id,
      name: def.name,
      groupId: def.groupId,
      openingBalance: 0,
      openingBalanceType: def.openingBalanceType,
      currentBalance: 0,
      isCashBank: Boolean((def as any).isCashBank),
    });
    return created.id;
  } catch (error) {
    // If creation fails due to duplicate, try to find it again
    console.warn(`System ledger creation failed for ${def.name}, retrying...`, error);
    const retryLedgers = await ledgerAccountService.list({ includeInactive: true });
    const retryExisting = retryLedgers.find((l) => l.id === def.id) || findLedgerByName(retryLedgers, def.name);
    if (retryExisting) return retryExisting.id;
    throw error;
  }
};

const ensurePartyLedger = async (nameRaw: string, kind: 'customer' | 'supplier') => {
  await ensureGroups();
  const name = sanitizeString(nameRaw) || (kind === 'customer' ? 'Cash Customer' : 'Cash Supplier');
  const targetGroupId = kind === 'customer' ? GROUPS.sundryDebtors.id : GROUPS.sundryCreditors.id;
  const openingBalanceType: LedgerBalanceType = kind === 'customer' ? 'DEBIT' : 'CREDIT';

  const ledgers = await ledgerAccountService.list({ includeInactive: true });
  const match = findLedgerByName(ledgers, name);
  if (match) return match.id;

  try {
    const created = await ledgerAccountService.create({
      name,
      groupId: targetGroupId,
      openingBalance: 0,
      openingBalanceType,
      currentBalance: 0,
      isCashBank: false,
    });
    return created.id;
  } catch (error) {
    // If creation fails due to duplicate, try to find it again
    console.warn(`Party ledger creation failed for ${name}, retrying...`, error);
    const retryLedgers = await ledgerAccountService.list({ includeInactive: true });
    const retryMatch = findLedgerByName(retryLedgers, name);
    if (retryMatch) return retryMatch.id;
    throw error;
  }
};

/** Run once at app boot after groups are seeded: move default Cash from legacy grp-cash-bank to Cash-in-Hand. */
export const migrateLegacySystemCashLedger = async (): Promise<void> => {
  const ledgers = await ledgerAccountService.list({ includeInactive: true });
  const cash = ledgers.find((l) => l.id === SYSTEM_LEDGERS.cash.id && l.groupId === GROUPS.cashBank.id);
  if (!cash) return;
  try {
    await ledgerAccountService.update(cash.id, { groupId: GROUP_CASH_IN_HAND_ID });
  } catch (e) {
    console.warn('migrateLegacySystemCashLedger:', e);
  }
};

export const autoLedgerService = {
  async ensureCore(): Promise<{
    cashLedgerId: string;
    salesLedgerId: string;
    purchaseLedgerId: string;
    purchaseReturnLedgerId: string;
    salesReturnLedgerId: string;
    gstLedgerId: string;
  }> {
    const [cashLedgerId, salesLedgerId, purchaseLedgerId, gstLedgerId, purchaseReturnLedgerId, salesReturnLedgerId] =
      await Promise.all([
        ensureSystemLedger(SYSTEM_LEDGERS.cash),
        ensureSystemLedger(SYSTEM_LEDGERS.sales),
        ensureSystemLedger(SYSTEM_LEDGERS.purchase),
        ensureSystemLedger(SYSTEM_LEDGERS.gst),
        ensureSystemLedger(SYSTEM_LEDGERS.purchaseReturns),
        ensureSystemLedger(SYSTEM_LEDGERS.salesReturns),
      ]);

    return {
      cashLedgerId,
      salesLedgerId,
      purchaseLedgerId,
      purchaseReturnLedgerId,
      salesReturnLedgerId,
      gstLedgerId,
    };
  },

  async ensureCustomerLedger(name: string) {
    return await ensurePartyLedger(name, 'customer');
  },

  async ensureSupplierLedger(name: string) {
    return await ensurePartyLedger(name, 'supplier');
  },

  /**
   * Ensure GST Output ledgers exist (for sales/invoices)
   */
  async ensureGSTOutputLedgers(): Promise<{
    cgstOutputLedgerId: string;
    sgstOutputLedgerId: string;
    igstOutputLedgerId: string;
  }> {
    const [cgstOutputLedgerId, sgstOutputLedgerId, igstOutputLedgerId] = await Promise.all([
      ensureSystemLedger(SYSTEM_LEDGERS.cgstOutput),
      ensureSystemLedger(SYSTEM_LEDGERS.sgstOutput),
      ensureSystemLedger(SYSTEM_LEDGERS.igstOutput),
    ]);
    return { cgstOutputLedgerId, sgstOutputLedgerId, igstOutputLedgerId };
  },

  /**
   * Ensure GST Input ledgers exist (for purchases)
   */
  async ensureGSTInputLedgers(): Promise<{
    cgstInputLedgerId: string;
    sgstInputLedgerId: string;
    igstInputLedgerId: string;
  }> {
    const [cgstInputLedgerId, sgstInputLedgerId, igstInputLedgerId] = await Promise.all([
      ensureSystemLedger(SYSTEM_LEDGERS.cgstInput),
      ensureSystemLedger(SYSTEM_LEDGERS.sgstInput),
      ensureSystemLedger(SYSTEM_LEDGERS.igstInput),
    ]);
    return { cgstInputLedgerId, sgstInputLedgerId, igstInputLedgerId };
  },

  /**
   * Ensure an expense ledger exists (auto-created under purchase accounts group)
   */
  async ensureExpenseLedger(nameRaw: string): Promise<string> {
    await ensureGroups();
    const name = sanitizeString(nameRaw) || 'Miscellaneous Expense';
    const targetGroupId = 'grp-indirect-expenses';
    const openingBalanceType: LedgerBalanceType = 'DEBIT';

    const ledgers = await ledgerAccountService.list({ includeInactive: true });
    const match = findLedgerByName(ledgers, name);
    if (match) return match.id;

    try {
      const created = await ledgerAccountService.create({
        name,
        groupId: targetGroupId,
        openingBalance: 0,
        openingBalanceType,
        currentBalance: 0,
        isCashBank: false,
      });
      return created.id;
    } catch (error) {
      // If creation fails due to duplicate, try to find it again
      console.warn(`Expense ledger creation failed for ${name}, retrying...`, error);
      const retryLedgers = await ledgerAccountService.list({ includeInactive: true });
      const retryMatch = findLedgerByName(retryLedgers, name);
      if (retryMatch) return retryMatch.id;
      throw error;
    }
  },

  /**
   * Ensure Round Off ledger exists
   */
  async ensureRoundOffLedger(): Promise<string> {
    return ensureSystemLedger(SYSTEM_LEDGERS.roundOff);
  },

  /**
   * Find party ledger by name and type
   */
  async findPartyLedger(name: string, partyType: 'CUSTOMER' | 'SUPPLIER'): Promise<string | null> {
    await ensureGroups();
    const ledgers = await ledgerAccountService.list({ includeInactive: true });
    const targetGroupId = partyType === 'CUSTOMER' ? GROUPS.sundryDebtors.id : GROUPS.sundryCreditors.id;
    
    // Search for exact match first
    const exactMatch = ledgers.find(ledger => 
      ledger.name.toLowerCase() === name.toLowerCase() && 
      ledger.groupId === targetGroupId
    );
    
    if (exactMatch) return exactMatch.id;
    
    // Search for partial match
    const partialMatch = ledgers.find(ledger => 
      ledger.name.toLowerCase().includes(name.toLowerCase()) && 
      ledger.groupId === targetGroupId
    );
    
    return partialMatch?.id || null;
  },

  };
