import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
} from '@mui/material';
import type { Party } from '../../types/party';
import { customersApi } from '../../services/customers/customersApi';

type Props = {
  open: boolean;
  party: Party | null;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
};

export function CustomerSafeDeleteDialog({ open, party, onClose, onDone, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [check, setCheck] = useState<{
    allowed: boolean;
    hasTransactions: boolean;
    hasOutstanding: boolean;
    needsConfirmation: boolean;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    if (!open || !party) {
      setCheck(null);
      return;
    }
    void customersApi.canPermanentlyDelete(party.id).then(setCheck);
  }, [open, party?.id]);

  const handleMarkInactive = async () => {
    if (!party) return;
    setLoading(true);
    try {
      await customersApi.markInactive(party.id);
      onDone(`${party.name} marked inactive`);
      onClose();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!party) return;
    setLoading(true);
    try {
      await customersApi.permanentDelete(party.id, { force: Boolean(check?.needsConfirmation) });
      onDone(`${party.name} permanently deleted (ledger removed)`);
      onClose();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const hasHistory = check && (check.hasTransactions || check.hasOutstanding);

  return (
    <Dialog open={open} onClose={() => !loading && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={800}>Delete debtor/creditor?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {party ? `Party: ${party.name}` : ''}
        </DialogContentText>
        {hasHistory ? (
          <Alert severity="warning">
            {check?.reason ||
              'This party has transaction history or balance. Deleting will also remove their ledger account.'}
          </Alert>
        ) : (
          <DialogContentText>
            No transaction history found. You may permanently delete this party (and linked ledger) or mark inactive to
            hide them from active lists.
          </DialogContentText>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="warning" onClick={() => void handleMarkInactive()} disabled={loading}>
            Mark Inactive
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handlePermanentDelete()}
            disabled={loading || check?.allowed === false}
          >
            Delete Permanently
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
