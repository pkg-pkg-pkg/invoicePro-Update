import { LedgerAccount, LedgerGroup, LedgerBalanceType } from '../../types/masters';
import { generateId } from '../../utils/id';
import { ledgerGroupService } from './ledgerGroupService';
import { nowIso, readList, sanitizeString, writeList } from './storageHelpers';

const STORAGE_KEY = 'pve_ledger_accounts';

export interface LedgerAccountFilters {
  groupId?: string;
  includeInactive?: boolean;
  isCashBank?: boolean;
  search?: string;
}

const computeDefaultCurrentBalance = (openingBalance: number, openingBalanceType: 'DEBIT' | 'CREDIT'): number => {
  if (!openingBalance) return 0;
  return openingBalanceType === 'DEBIT' ? openingBalance : -openingBalance;
};

const normalizeNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return num;
};

const validateGroup = async (groupId: string): Promise<LedgerGroup> => {
  const group = await ledgerGroupService.getById(groupId);
  if (!group) {
    throw new Error('Ledger group not found');
  }
  if (group.isActive === false) {
    throw new Error('Ledger group is inactive');
  }
  return group;
};

const buildAccount = async (payload: Partial<LedgerAccount>, isCreate: boolean): Promise<LedgerAccount> => {
  const name: string | null = sanitizeString(payload.name ?? null);
  if (!name) {
    throw new Error('Account name is required');
  }

  if (!isCreate && !payload.id) {
    throw new Error('Account id is required');
  }

  const sanitizedGroupId: string | null = sanitizeString(payload.groupId ?? null);
  if (!sanitizedGroupId) {
    throw new Error('Group is required');
  }
  const group: LedgerGroup = await validateGroup(sanitizedGroupId);

  const openingBalance = normalizeNumber(payload.openingBalance, 0);
  if (openingBalance < 0) {
    throw new Error('Opening balance cannot be negative');
  }

  const openingBalanceType: LedgerBalanceType | undefined = payload.openingBalanceType;
  if (openingBalanceType !== 'DEBIT' && openingBalanceType !== 'CREDIT') {
    throw new Error('Opening balance type is required');
  }

  const currentBalance: number =
    payload.currentBalance !== undefined
      ? normalizeNumber(payload.currentBalance, 0)
      : isCreate
      ? computeDefaultCurrentBalance(openingBalance, openingBalanceType)
      : 0;

  if (payload.isCashBank) {
    if (group.type !== 'ASSET') {
      throw new Error('Cash/Bank accounts must belong to an Asset group');
    }
  }

  const account: LedgerAccount = {
    id: payload.id ?? generateId('led'),
    name,
    code: sanitizeString(payload.code ?? null),
    groupId: sanitizedGroupId,
    openingBalance,
    openingBalanceType: openingBalanceType!,
    currentBalance,
    gstDetails: payload.gstDetails ?? null,
    contactDetails: payload.contactDetails ?? null,
    isCashBank: Boolean(payload.isCashBank),
    isActive: payload.isActive ?? true,
    createdAt: payload.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };

  return account;
};

const filterAccounts = (accounts: LedgerAccount[], filters: LedgerAccountFilters) => {
  const text = sanitizeString(filters.search ?? null)?.toLowerCase();
  return accounts.filter((acct) => {
    if (!filters.includeInactive && acct.isActive === false) return false;
    if (filters.groupId && acct.groupId !== filters.groupId) return false;
    if (typeof filters.isCashBank === 'boolean' && acct.isCashBank !== filters.isCashBank) return false;
    if (text) {
      const haystack = `${acct.name} ${acct.code ?? ''}`.toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    return true;
  });
};

const ensureUniqueConstraints = (accounts: LedgerAccount[], candidate: LedgerAccount, skipIndex?: number) => {
  const nameExists: boolean = accounts.some(
    (acct, idx) => idx !== skipIndex && acct.name.toLowerCase() === candidate.name.toLowerCase()
  );
  if (nameExists) {
    throw new Error('Account name already exists');
  }

  if (candidate.code) {
    const codeExists: boolean = accounts.some(
      (acct, idx) => idx !== skipIndex && acct.code && acct.code.toLowerCase() === candidate.code!.toLowerCase()
    );
    if (codeExists) {
      throw new Error('Account code already exists');
    }
  }
};

export const ledgerAccountService = {
  async list(filters: LedgerAccountFilters = {}): Promise<LedgerAccount[]> {
    const accounts = await readList<LedgerAccount>(STORAGE_KEY);
    return filterAccounts(accounts, filters).sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
    );
  },

  async getById(id: string): Promise<LedgerAccount | null> {
    const accounts = await readList<LedgerAccount>(STORAGE_KEY);
    return accounts.find((acct) => acct.id === id) ?? null;
  },

  async create(payload: Partial<LedgerAccount>): Promise<LedgerAccount> {
    const accounts = await readList<LedgerAccount>(STORAGE_KEY);
    const account = await buildAccount(payload, true);
    ensureUniqueConstraints(accounts, account);
    accounts.push(account);
    await writeList(STORAGE_KEY, accounts);
    return account;
  },

  async update(id: string, payload: Partial<LedgerAccount>): Promise<LedgerAccount> {
    const accounts = await readList<LedgerAccount>(STORAGE_KEY);
    const index = accounts.findIndex((acct) => acct.id === id);
    if (index < 0) {
      throw new Error('Account not found');
    }
    const current = accounts[index];

    if (payload.openingBalance !== undefined && payload.openingBalance !== current.openingBalance) {
      throw new Error('Opening balance cannot be modified after creation');
    }
    if (payload.openingBalanceType && payload.openingBalanceType !== current.openingBalanceType) {
      throw new Error('Opening balance type cannot be modified after creation');
    }

    const merged: Partial<LedgerAccount> = {
      ...current,
      ...payload,
      id: current.id,
      openingBalance: current.openingBalance,
      openingBalanceType: current.openingBalanceType,
      createdAt: current.createdAt,
    };

    const updated = await buildAccount(merged, false);
    updated.currentBalance = current.currentBalance; // preserve balance unless adjusted explicitly

    ensureUniqueConstraints(accounts, updated, index);
    accounts[index] = updated;
    await writeList(STORAGE_KEY, accounts);
    return updated;
  },

  async softDelete(id: string): Promise<void> {
    const accounts = await readList<LedgerAccount>(STORAGE_KEY);
    const index = accounts.findIndex((acct) => acct.id === id);
    if (index < 0) {
      throw new Error('Account not found');
    }
    accounts[index] = { ...accounts[index], isActive: false, updatedAt: nowIso() };
    await writeList(STORAGE_KEY, accounts);
  },

  async restore(id: string): Promise<void> {
    const accounts = await readList<LedgerAccount>(STORAGE_KEY);
    const index = accounts.findIndex((acct) => acct.id === id);
    if (index < 0) {
      throw new Error('Account not found');
    }
    accounts[index] = { ...accounts[index], isActive: true, updatedAt: nowIso() };
    await writeList(STORAGE_KEY, accounts);
  },

  async adjustCurrentBalance(id: string, delta: number): Promise<LedgerAccount> {
    const accounts = await readList<LedgerAccount>(STORAGE_KEY);
    const index = accounts.findIndex((acct) => acct.id === id);
    if (index < 0) {
      throw new Error('Account not found');
    }
    const updatedBalance = (accounts[index].currentBalance ?? 0) + delta;
    accounts[index] = { ...accounts[index], currentBalance: updatedBalance, updatedAt: nowIso() };
    await writeList(STORAGE_KEY, accounts);
    return accounts[index];
  },

  async setCurrentBalance(id: string, value: number): Promise<LedgerAccount> {
    const accounts = await readList<LedgerAccount>(STORAGE_KEY);
    const index = accounts.findIndex((acct) => acct.id === id);
    if (index < 0) {
      throw new Error('Account not found');
    }
    accounts[index] = { ...accounts[index], currentBalance: value, updatedAt: nowIso() };
    await writeList(STORAGE_KEY, accounts);
    return accounts[index];
  },

  async clearAll() {
    await writeList(STORAGE_KEY, []);
  },
};
