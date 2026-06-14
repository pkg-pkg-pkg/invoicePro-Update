import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Breadcrumbs, Button, Link, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useParams } from 'react-router-dom';
import type { Party, PartyInput } from '../../types/party';
import {
  customersApi,
  type CustomerComment,
  type CustomerMailRow,
  type CustomerStatementRow,
  type CustomerTransactionsBundle,
} from '../../services/customers/customersApi';
import { CustomerDetailPanel } from '../../components/customers/CustomerDetailPanel';
import { CustomerFormModal } from '../../components/customers/CustomerFormModal';
import { CustomerSafeDeleteDialog } from '../../components/customers/CustomerSafeDeleteDialog';
import { useAuth } from '../contexts/auth';
import { useUserDisplayName } from '../../hooks/useUserDisplayName';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = useUserDisplayName();

  const [customer, setCustomer] = useState<Party | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [transactions, setTransactions] = useState<CustomerTransactionsBundle | null>(null);
  const [comments, setComments] = useState<CustomerComment[]>([]);
  const [mails, setMails] = useState<CustomerMailRow[]>([]);
  const [statementRows, setStatementRows] = useState<CustomerStatementRow[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const userLabel = displayName || user?.fullName || user?.email || 'User';

  const loadCustomer = useCallback(async () => {
    if (!id) return;
    setDetailLoading(true);
    setError(null);
    try {
      const party = await customersApi.getById(id);
      if (!party) {
        setError('Debtor not found');
        setCustomer(null);
        return;
      }
      setCustomer(party);
      const [tx, cmt, ml] = await Promise.all([
        customersApi.getTransactions(party),
        Promise.resolve(customersApi.listComments(party.id)),
        Promise.resolve(customersApi.listMails(party.id)),
      ]);
      setTransactions(tx);
      setComments(cmt);
      setMails(ml);
      setStatementRows([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadCustomer();
  }, [loadCustomer]);

  const handleSubmit = async (values: PartyInput) => {
    if (!customer) return;
    setSaving(true);
    try {
      await customersApi.update(customer.id, values);
      setFormOpen(false);
      await loadCustomer();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateStatement = async (from: string, to: string) => {
    if (!customer) return;
    setStatementLoading(true);
    try {
      const rows = await customersApi.getStatement(customer, from, to);
      setStatementRows(rows);
    } finally {
      setStatementLoading(false);
    }
  };

  if (!id) {
    return <Alert severity="warning">Invalid customer link.</Alert>;
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/ledgers/debtors')}>
          Back to Debtors
        </Button>
      </Stack>

      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component="button" underline="hover" color="inherit" onClick={() => navigate('/ledgers/debtors')}>
          Ledgers
        </Link>
        <Typography color="text.primary" fontWeight={700}>
          {customer?.name ?? '…'}
        </Typography>
      </Breadcrumbs>

      {error ? <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert> : null}

      <CustomerDetailPanel
        customer={customer}
        loading={detailLoading}
        transactions={transactions}
        comments={comments}
        mails={mails}
        statementRows={statementRows}
        statementLoading={statementLoading}
        onEdit={() => setFormOpen(true)}
        onClose={() => navigate('/ledgers/debtors')}
        onDelete={() => setDeleteOpen(true)}
        onAddComment={(text) => {
          if (!customer) return;
          setComments(customersApi.addComment(customer.id, text, userLabel));
        }}
        onGenerateStatement={(from, to) => void handleGenerateStatement(from, to)}
      />

      <CustomerFormModal
        open={formOpen}
        mode="edit"
        party={customer}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSubmit={async () => {
          setFormOpen(false);
          if (customer) {
            const refreshed = await customersApi.getById(customer.id);
            if (refreshed) setCustomer(refreshed);
          }
        }}
      />

      <CustomerSafeDeleteDialog
        open={deleteOpen}
        party={customer}
        onClose={() => setDeleteOpen(false)}
        onDone={() => navigate('/ledgers/debtors')}
        onError={(msg) => setError(msg)}
      />
    </Box>
  );
}
