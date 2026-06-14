import { Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LedgerAccount } from '../../types/masters';
import { ledgerAccountService } from '../../services/masters/ledgerAccountService';
import { ledgerGroupService } from '../../services/masters/ledgerGroupService';
import {
  ledgerTouchesExpenseTree,
  ledgerTouchesIncomeTree,
} from '../../utils/expenseLedgerGrouping';
import { ListPickerModal } from '../../pages/Vouchers/Sales/components/ListPickerModal';

export type PartyPickerScope = 'debtor' | 'creditor' | 'receipt' | 'payment' | 'all';

export type PartyPickerModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (ledger: LedgerAccount) => void;
  scope?: PartyPickerScope;
  title?: string;
  onCreateNew?: () => void;
  createNewLabel?: string;
};

const DEBTOR_GROUP = 'grp-sundry-debtors';
const CREDITOR_GROUP = 'grp-sundry-creditors';

const formatBalance = (ledger: LedgerAccount): string => {
  const raw = Number(ledger.currentBalance ?? 0);
  const side = raw >= 0 ? 'Dr' : 'Cr';
  return `₹${Math.abs(raw).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${side}`;
};

const partyTypeLabel = (ledger: LedgerAccount): string => {
  const gid = String(ledger.groupId ?? '');
  if (gid === DEBTOR_GROUP) return 'Debtor';
  if (gid === CREDITOR_GROUP) return 'Creditor';
  return 'Ledger';
};

export function PartyPickerModal({
  open,
  onClose,
  onSelect,
  scope = 'all',
  title = 'Select Party',
  onCreateNew,
  createNewLabel = '+ Create New Party',
}: PartyPickerModalProps) {
  const [rows, setRows] = useState<LedgerAccount[]>([]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [ledgers, groups] = await Promise.all([
        ledgerAccountService.list({ includeInactive: false }),
        ledgerGroupService.list({ includeInactive: true }),
      ]);
      const gMap = new Map(
        groups.map((g) => [g.id, { type: g.type, parentGroupId: g.parentGroupId }])
      );

      const filtered = ledgers.filter((ledger) => {
        const gid = String(ledger.groupId ?? '');
        if (scope === 'debtor') return gid === DEBTOR_GROUP;
        if (scope === 'creditor') return gid === CREDITOR_GROUP;
        if (scope === 'receipt') {
          return (
            gid === DEBTOR_GROUP ||
            gid === CREDITOR_GROUP ||
            ledgerTouchesIncomeTree(gid, gMap)
          );
        }
        if (scope === 'payment') {
          return (
            gid === DEBTOR_GROUP ||
            gid === CREDITOR_GROUP ||
            ledgerTouchesExpenseTree(gid, gMap)
          );
        }
        return gid === DEBTOR_GROUP || gid === CREDITOR_GROUP;
      });

      setRows(
        filtered.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
      );
    })();
  }, [open, scope]);

  const filterRow = useCallback((ledger: LedgerAccount, query: string) => {
    const s = query.trim().toLowerCase();
    if (!s) return true;
    const name = String(ledger.name ?? '').toLowerCase();
    const phone = String(ledger.contactDetails?.phone ?? '').toLowerCase();
    const gst = String(ledger.gstDetails?.gstin ?? '').toLowerCase();
    const code = String(ledger.code ?? '').toLowerCase();
    return name.includes(s) || phone.includes(s) || gst.includes(s) || code.includes(s);
  }, []);

  const searchPlaceholder = useMemo(() => {
    if (scope === 'debtor') return 'Search debtors by name, phone, or GSTIN…';
    if (scope === 'creditor') return 'Search creditors by name, phone, or GSTIN…';
    return 'Search party by name, phone, or GSTIN…';
  }, [scope]);

  return (
    <ListPickerModal<LedgerAccount>
      open={open}
      onClose={onClose}
      title={title}
      searchPlaceholder={searchPlaceholder}
      hintText="Type to search, ↑ ↓ to navigate, Enter to select."
      rows={rows}
      getRowKey={(l) => l.id}
      filterRow={filterRow}
      columns={[
        {
          id: 'name',
          header: 'Party Name',
          render: (l) => <Typography fontWeight={600}>{l.name}</Typography>,
        },
        {
          id: 'type',
          header: 'Type',
          width: 88,
          render: (l) => (
            <Typography variant="body2" color="text.secondary">
              {partyTypeLabel(l)}
            </Typography>
          ),
        },
        {
          id: 'phone',
          header: 'Phone',
          width: 110,
          render: (l) => (
            <Typography variant="body2" color="text.secondary">
              {l.contactDetails?.phone || '—'}
            </Typography>
          ),
        },
        {
          id: 'balance',
          header: 'Balance',
          align: 'right',
          width: 120,
          render: (l) => (
            <Typography variant="body2" fontWeight={600}>
              {formatBalance(l)}
            </Typography>
          ),
        },
      ]}
      onSelect={onSelect}
      onCreateNew={onCreateNew}
      createNewLabel={createNewLabel}
      emptyMessage="No parties found."
    />
  );
}
