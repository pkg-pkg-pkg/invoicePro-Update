import { Party, PartyInput, PartyFilters, PartyType } from '../../types/party';
import { generateId } from '../../utils/id';
import { ledgerAccountService } from './ledgerAccountService';
import { autoLedgerService } from './autoLedgerService';
import { readList, writeList, sanitizeString } from './storageHelpers';
import { companyScopedKey } from '../../utils/companyStorage';

export const PARTIES_CHANGED_EVENT = 'pve:parties-changed';

const STORAGE_KEY = companyScopedKey('pve_parties');

/** Ledger code must be unique; first-5-chars-only collides often (e.g. multiple "Pawan…" names). */
const uniqueLedgerCode = (partyName: string): string => {
  const base = sanitizeString(partyName)?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PTY';
  const suffix = generateId('c').replace(/-/g, '').slice(-10).toUpperCase();
  return `${base}-${suffix}`;
};

/** Digits only; compare last 10 so +91 / 0 prefix / spaces match the same subscriber. */
export const normalizePartyMobile = (raw: string | undefined): string => {
  if (raw == null || !String(raw).trim()) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
};

const PARTY_LEDGER_GROUP_IDS = ['grp-sundry-debtors', 'grp-sundry-creditors'] as const;

/** Ledger-only parties (no separate DB table): id = `pl-${ledgerId}` */
const PARTY_FROM_LEDGER_PREFIX = 'pl-';

/** Persist which sundry ledgers user removed from Party Master (so we do not re-hydrate them). */
const DELETED_PARTY_LEDGER_IDS_KEY = 'pve_party_deleted_ledger_ids';

type MobileConflict =
  | { kind: 'party'; name: string; partyId: string }
  | { kind: 'ledger'; name: string; ledgerId: string };

class PartyService {
  private parties: Party[] = [];
  private _hydrateRunning: Promise<void> | null = null;
  private _loadedFromStorage = false;

  private notifyChanged(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PARTIES_CHANGED_EVENT));
    }
  }

  private async persistParties(): Promise<void> {
    await writeList(
      STORAGE_KEY,
      this.parties.map((p) => ({
        ...p,
        id: p.id,
        updatedAt: p.updatedAt ?? new Date().toISOString(),
        createdAt: p.createdAt ?? new Date().toISOString(),
      }))
    );
    this.notifyChanged();
  }

  private async loadPersistedParties(): Promise<void> {
    if (this._loadedFromStorage) return;
    const rows = await readList<Party>(STORAGE_KEY);
    this.parties = rows.map((p) => ({ ...p, status: p.status ?? 'ACTIVE' }));
    this._loadedFromStorage = true;
  }

  private getDeletedLedgerIds(): Set<string> {
    try {
      if (typeof localStorage === 'undefined') return new Set();
      const raw = localStorage.getItem(DELETED_PARTY_LEDGER_IDS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch {
      return new Set();
    }
  }

  private persistDeletedLedgerId(ledgerId: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const s = this.getDeletedLedgerIds();
      s.add(ledgerId);
      localStorage.setItem(DELETED_PARTY_LEDGER_IDS_KEY, JSON.stringify([...s]));
    } catch {
      /* ignore */
    }
  }

  /** Auto-created placeholder ledgers — not shown as parties. */
  private isExcludedLedgerName(name: string): boolean {
    const n = name.trim().toLowerCase();
    return (
      n.includes('for group creation') ||
      n === 'cash customer' ||
      n === 'cash supplier'
    );
  }

  /**
   * Merge sundry debtor/creditor ledgers into the party list (persisted storage).
   * In-memory-only rows were empty after restart; ledgers survive.
   */
  private async doHydrateLedgerParties(): Promise<void> {
    const hidden = this.getDeletedLedgerIds();
    const ledgers = await ledgerAccountService.list({ includeInactive: false });

    for (const l of ledgers) {
      if (!PARTY_LEDGER_GROUP_IDS.includes(l.groupId as (typeof PARTY_LEDGER_GROUP_IDS)[number])) continue;
      if (this.isExcludedLedgerName(l.name)) continue;
      if (hidden.has(l.id)) continue;
      if (this.parties.some((p) => p.ledgerId === l.id)) continue;

      const party: Party = {
        id: `${PARTY_FROM_LEDGER_PREFIX}${l.id}`,
        name: l.name,
        mobile: l.contactDetails?.phone ?? '',
        gstin: l.gstDetails?.gstin,
        address: l.contactDetails?.address,
        partyType: l.groupId === 'grp-sundry-creditors' ? 'SUPPLIER' : 'BUYER',
        email: l.contactDetails?.email,
        ledgerId: l.id,
        ledgerGroup: l.groupId,
        openingBalance: l.openingBalance,
        currentBalance: l.currentBalance ?? l.openingBalance,
        status: 'ACTIVE',
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      };
      this.parties.push(party);
    }
  }

  private async ensureLedgerPartiesHydrated(): Promise<void> {
    if (this._hydrateRunning) {
      await this._hydrateRunning;
      return;
    }
    this._hydrateRunning = (async () => {
      await this.loadPersistedParties();
      const before = this.parties.length;
      await this.doHydrateLedgerParties();
      if (this.parties.length !== before) {
        await this.persistParties();
      }
    })();
    try {
      await this._hydrateRunning;
    } finally {
      this._hydrateRunning = null;
    }
  }

  /**
   * Auto-assign ledger group based on party type
   */
  private getAutoLedgerGroup(partyType: PartyType): string {
    switch (partyType) {
      case 'BUYER':
        return 'grp-sundry-debtors'; // Sundry Debtors (Customers)
      case 'SUPPLIER':
        return 'grp-sundry-creditors'; // Sundry Creditors (Suppliers)
      case 'BOTH':
        return 'grp-sundry-debtors'; // Default to Debtors, handle dynamically in posting
      default:
        return 'grp-sundry-debtors';
    }
  }

  /**
   * Whether this normalized mobile is already tied to another party or sundry ledger.
   */
  private async findMobileConflict(
    mobile: string | undefined,
    opts?: { excludePartyId?: string; excludeLedgerId?: string }
  ): Promise<MobileConflict | null> {
    await this.ensureLedgerPartiesHydrated();
    const key = normalizePartyMobile(mobile);
    if (!key) return null;

    for (const p of this.parties) {
      if (p.status === 'INACTIVE') continue;
      if (opts?.excludePartyId && p.id === opts.excludePartyId) continue;
      if (normalizePartyMobile(p.mobile) === key) {
        return { kind: 'party', name: p.name, partyId: p.id };
      }
    }

    const ledgers = await ledgerAccountService.list({ includeInactive: false });
    for (const l of ledgers) {
      if (!PARTY_LEDGER_GROUP_IDS.includes(l.groupId as (typeof PARTY_LEDGER_GROUP_IDS)[number])) continue;
      if (opts?.excludeLedgerId && l.id === opts.excludeLedgerId) continue;
      if (normalizePartyMobile(l.contactDetails?.phone) === key) {
        return { kind: 'ledger', name: l.name, ledgerId: l.id };
      }
    }
    return null;
  }

  /** Live form hint (e.g. on blur) — same rules as save, without throwing. */
  async getMobileDuplicateHint(
    mobile: string | undefined,
    opts?: { excludePartyId?: string; excludeLedgerId?: string }
  ): Promise<string | null> {
    const c = await this.findMobileConflict(mobile, opts);
    if (!c) return null;
    if (c.kind === 'party') {
      return `This number is already used by party "${c.name}". Open that party to edit, or change the number (save will be blocked).`;
    }
    return `This number is already on ledger "${c.name}". Use that account as the party, or change the number (save will be blocked).`;
  }

  /** One mobile → one party/ledger (sundry customers & suppliers). Skips check if mobile empty. */
  private async assertMobileNotDuplicate(
    mobile: string | undefined,
    opts?: { excludePartyId?: string; excludeLedgerId?: string }
  ): Promise<void> {
    const c = await this.findMobileConflict(mobile, opts);
    if (!c) return;
    if (c.kind === 'party') {
      throw new Error(
        `This mobile number is already used by party "${c.name}". Open that party to edit or enter a different number.`
      );
    }
    throw new Error(
      `This mobile number is already linked to ledger "${c.name}". Use that account as the party or change the number.`
    );
  }

  /**
   * Create a new party with auto-ledger creation
   */
  async create(input: PartyInput): Promise<Party> {
    const partyId = generateId('party');
    
    console.log('🎯 Creating party:', { name: input.name, partyType: input.partyType });

    await this.assertMobileNotDuplicate(input.mobile);
    
    // Ensure core ledger groups exist first (silent, no user interaction)
    try {
      console.log('🔧 Ensuring ledger groups exist...');
      await autoLedgerService.ensureCore();
      
      // Also ensure party-specific groups are created
      await autoLedgerService.ensureCustomerLedger('Temp Customer For Group Creation');
      await autoLedgerService.ensureSupplierLedger('Temp Supplier For Group Creation');
      
      console.log('✅ All ledger groups ensured');
    } catch (coreError) {
      console.error('❌ Failed to ensure core groups:', coreError);
      // Try to continue anyway, groups might already exist
    }
    
    // Auto-assign ledger group (internal logic, not exposed to user)
    const ledgerGroup = this.getAutoLedgerGroup(input.partyType);
    console.log('📋 Assigned ledger group:', ledgerGroup);
    
    // Create ledger account automatically with error handling
    let ledger;
    try {
      console.log('🔧 Creating ledger account...');
      ledger = await ledgerAccountService.create({
        name: input.name,
        code: uniqueLedgerCode(input.name),
        groupId: ledgerGroup,
        openingBalance: input.openingBalance || 0,
        openingBalanceType: input.partyType === 'SUPPLIER' ? 'CREDIT' : 'DEBIT',
        gstDetails: input.gstin ? { gstin: input.gstin } : null,
        contactDetails: {
          phone: input.mobile,
          email: input.email || undefined,
          address: input.address || undefined,
        },
        isCashBank: false,
        isActive: true,
      });
      console.log('✅ Ledger account created:', ledger.id);
    } catch (ledgerError) {
      console.error('❌ Ledger creation failed:', ledgerError);
      
      // If the error is about group not found, try to create the group directly
      if (ledgerError instanceof Error && ledgerError.message.includes('Ledger group not found')) {
        console.warn('🔄 Group not found, attempting to create it directly...');
        try {
          // Import and use ledgerGroupService directly
          const { ledgerGroupService } = await import('./ledgerGroupService');
          
          if (ledgerGroup === 'grp-sundry-debtors') {
            await ledgerGroupService.create({
              id: 'grp-sundry-debtors',
              name: 'Sundry Debtors',
              type: 'ASSET',
              code: 'SDEBT',
              parentGroupId: null,
              isSystem: true,
              sortOrder: 10,
              isActive: true,
            });
            console.log('✅ Created Sundry Debtors group');
          } else if (ledgerGroup === 'grp-sundry-creditors') {
            await ledgerGroupService.create({
              id: 'grp-sundry-creditors',
              name: 'Sundry Creditors',
              type: 'LIABILITY',
              code: 'SCRED',
              parentGroupId: null,
              isSystem: true,
              sortOrder: 11,
              isActive: true,
            });
            console.log('✅ Created Sundry Creditors group');
          }
          
          // Try creating the ledger again
          console.log('🔄 Retrying ledger creation...');
      ledger = await ledgerAccountService.create({
        name: input.name,
        code: uniqueLedgerCode(input.name),
        groupId: ledgerGroup,
        openingBalance: input.openingBalance || 0,
        openingBalanceType: input.partyType === 'SUPPLIER' ? 'CREDIT' : 'DEBIT',
        gstDetails: input.gstin ? { gstin: input.gstin } : null,
        contactDetails: {
          phone: input.mobile,
          email: input.email || undefined,
          address: input.address || undefined,
        },
        isCashBank: false,
        isActive: true,
      });
          console.log('✅ Ledger account created on retry:', ledger.id);
          
        } catch (groupCreateError) {
          console.error('❌ Failed to create group:', groupCreateError);
          const msg = groupCreateError instanceof Error ? groupCreateError.message : String(groupCreateError);
          throw new Error(`Failed to create party: ${msg}`);
        }
      } else {
        // For other errors, try the existing fallback logic
        console.warn('🔄 Trying fallback ledger creation...');
        try {
          // Try to get existing ledger or create minimal one
          const existingLedgers = await ledgerAccountService.list({ includeInactive: false });
          ledger = existingLedgers.find(l => l.name === input.name) || 
                  await ledgerAccountService.create({
                    name: input.name,
                    code: uniqueLedgerCode(input.name),
                    groupId: ledgerGroup,
                    openingBalance: input.openingBalance || 0,
                    openingBalanceType: input.partyType === 'SUPPLIER' ? 'CREDIT' : 'DEBIT',
                    isCashBank: false,
                    isActive: true,
                  });
          console.log('✅ Fallback ledger created:', ledger.id);
        } catch (fallbackError) {
          console.error('❌ All ledger creation attempts failed:', fallbackError);
          const msg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          throw new Error(`Failed to create party: ${msg}`);
        }
      }
    }

    const party: Party = {
      id: partyId,
      name: input.name,
      mobile: input.mobile,
      gstin: input.gstin,
      address: input.address,
      city: input.city,
      district: input.district,
      state: input.state,
      pincode: input.pincode,
      partyType: input.partyType,
      email: input.email,
      whatsapp: input.whatsapp,
      openingBalance: input.openingBalance || 0,
      currentBalance: input.openingBalance || 0,
      ledgerId: ledger.id,
      ledgerGroup,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.parties.push(party);
    console.log('✅ Party created successfully:', { id: party.id, name: party.name, ledgerId: party.ledgerId });
    await this.persistParties();
    return party;
  }

  /**
   * Get party by ID
   */
  async getById(id: string): Promise<Party | null> {
    await this.ensureLedgerPartiesHydrated();
    return this.parties.find(p => p.id === id) || null;
  }

  /**
   * List parties with optional filters
   */
  async list(filters?: PartyFilters): Promise<Party[]> {
    await this.ensureLedgerPartiesHydrated();
    let filtered = [...this.parties];

    if (filters?.status) {
      filtered = filtered.filter((p) => p.status === filters.status);
    } else {
      filtered = filtered.filter((p) => p.status !== 'INACTIVE');
    }

    if (filters?.partyType) {
      const types = Array.isArray(filters.partyType) ? filters.partyType : [filters.partyType];
      filtered = filtered.filter(p => 
        types.includes(p.partyType) || p.partyType === 'BOTH'
      );
    }

    if (filters?.status) {
      filtered = filtered.filter(p => p.status === filters.status);
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.mobile.includes(search) ||
        p.gstin?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }

  /**
   * Get parties for Sales Voucher (BUYER or BOTH)
   */
  async listForSales(): Promise<Party[]> {
    return this.list({ partyType: ['BUYER', 'BOTH'] });
  }

  /**
   * Get parties for Purchase Voucher (SUPPLIER or BOTH)
   */
  async listForPurchase(): Promise<Party[]> {
    return this.list({ partyType: ['SUPPLIER', 'BOTH'] });
  }

  /**
   * Update party
   */
  async update(id: string, input: Partial<PartyInput>): Promise<Party> {
    await this.ensureLedgerPartiesHydrated();
    const index = this.parties.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Party not found');
    }

    const party = this.parties[index];
    const nextMobile = input.mobile !== undefined ? input.mobile : party.mobile;
    await this.assertMobileNotDuplicate(nextMobile, {
      excludePartyId: id,
      excludeLedgerId: party.ledgerId,
    });
    
    // If party type changed, update ledger group
    if (input.partyType && input.partyType !== party.partyType) {
      const newLedgerGroup = this.getAutoLedgerGroup(input.partyType);
      
      // Update ledger account group
      if (party.ledgerId) {
        await ledgerAccountService.update(party.ledgerId, {
          groupId: newLedgerGroup,
        } as any);
      }
      
      party.ledgerGroup = newLedgerGroup;
    }

    // Update party fields
    const updated = {
      ...party,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.parties[index] = updated;

    // Update ledger account
    if (party.ledgerId) {
      await ledgerAccountService.update(party.ledgerId, {
        name: updated.name,
        gstDetails: updated.gstin ? { gstin: updated.gstin } : null,
        contactDetails: {
          phone: updated.mobile,
          email: updated.email || undefined,
          address: updated.address || undefined,
        },
      } as any);
    }

    await this.persistParties();
    return updated;
  }

  /**
   * Delete party (soft delete)
   */
  async delete(id: string): Promise<void> {
    await this.ensureLedgerPartiesHydrated();
    const index = this.parties.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Party not found');
    }

    const row = this.parties[index];
    if (row.ledgerId) {
      this.persistDeletedLedgerId(row.ledgerId);
    }

    this.parties[index] = {
      ...this.parties[index],
      status: 'INACTIVE',
      updatedAt: new Date().toISOString(),
    };
    await this.persistParties();
  }

  /**
   * Ensure a sundry ledger exists for this party (required for ledger reports & vouchers).
   */
  async ensureLedgerForParty(partyId: string): Promise<string | null> {
    await this.ensureLedgerPartiesHydrated();
    const index = this.parties.findIndex((p) => p.id === partyId);
    if (index < 0) return null;
    const party = this.parties[index];
    if (party.ledgerId) return party.ledgerId;

    await autoLedgerService.ensureCore();
    const ledgerGroup = this.getAutoLedgerGroup(party.partyType);
    const ledger = await ledgerAccountService.create({
      name: party.name,
      code: uniqueLedgerCode(party.name),
      groupId: ledgerGroup,
      openingBalance: party.openingBalance || 0,
      openingBalanceType: party.partyType === 'SUPPLIER' ? 'CREDIT' : 'DEBIT',
      gstDetails: party.gstin ? { gstin: party.gstin } : null,
      contactDetails: {
        phone: party.mobile,
        email: party.email || undefined,
        address: party.address || undefined,
      },
      isCashBank: false,
      isActive: true,
    });

    this.parties[index] = {
      ...party,
      ledgerId: ledger.id,
      ledgerGroup,
      updatedAt: new Date().toISOString(),
    };
    await this.persistParties();
    return ledger.id;
  }

  /**
   * Get ledger ID for a party (for voucher posting)
   */
  async getLedgerId(partyId: string): Promise<string | null> {
    const party = await this.getById(partyId);
    return party?.ledgerId || null;
  }
}

export const partyService = new PartyService();
