import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Menu,
  MenuItem,
  Snackbar,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { ActionContext, DocumentListKind, PendingConfirm, RowActionId } from './types';
import { getRowActionsForContext } from './documentRowActionsConfig';
import { createRowActionHandlers } from './documentRowActionsHandlers';
import { CustomerSafeDeleteDialog } from '../customers/CustomerSafeDeleteDialog';
import type { Party } from '../../types/party';

type Props = {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  context: ActionContext | null;
  listKind?: DocumentListKind;
  title?: string;
  onRefresh?: () => void;
  onEditCustomer?: (partyId: string) => void;
};

export function DocumentRowActionsMenu({
  anchorEl,
  open,
  onClose,
  context,
  listKind,
  title = 'Document',
  onRefresh,
  onEditCustomer,
}: Props) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [deleteParty, setDeleteParty] = useState<Party | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, severity });
  }, []);

  const handlers = useMemo(
    () =>
      createRowActionHandlers({
        navigate,
        onRefresh,
        showToast,
        onEditCustomer,
      }),
    [navigate, onRefresh, showToast, onEditCustomer]
  );

  const resolvedContext: ActionContext | null = useMemo(() => {
    if (!context) return null;
    if (context.type === 'document' && listKind) {
      return { ...context, listKind, title: title ?? context.title };
    }
    return context;
  }, [context, listKind, title]);

  const actions = useMemo(
    () => (resolvedContext ? getRowActionsForContext(resolvedContext) : []),
    [resolvedContext]
  );

  const runAction = async (actionId: RowActionId) => {
    if (!resolvedContext) return;
    onClose();

    if (resolvedContext.type === 'customer' && actionId === 'delete') {
      setDeleteParty(resolvedContext.party);
      return;
    }

    const confirmMeta = handlers.needsConfirm(actionId, resolvedContext);
    if (confirmMeta) {
      const isDelete = confirmMeta.kind === 'delete';
      const isReactivate = confirmMeta.kind === 'reactivate';
      setConfirm({
        kind: confirmMeta.kind,
        title: isReactivate ? 'Activate this customer?' : isDelete ? 'Delete record?' : 'Cancel record?',
        message: isReactivate
          ? `Activate ${confirmMeta.title}? The customer will appear in active lists again.`
          : isDelete
            ? 'Are you sure you want to delete this record? This action cannot be undone.'
            : `Are you sure you want to cancel ${confirmMeta.title}? This action cannot be undone.`,
        confirmLabel: isReactivate ? 'Activate' : isDelete ? 'Yes, Delete' : 'Yes, Cancel',
        onConfirm: async () => {
          await handlers.execute(actionId, resolvedContext);
        },
      });
      return;
    }

    try {
      await handlers.execute(actionId, resolvedContext);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.onConfirm();
      setConfirm(null);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {actions.flatMap((action) => {
          const items = [];
          if (action.dividerBefore) {
            items.push(<Divider key={`${action.id}-divider`} />);
          }
          items.push(
            <MenuItem
              key={action.id}
              onClick={() => void runAction(action.id)}
              sx={action.destructive ? { color: 'error.main' } : undefined}
            >
              {action.label}
            </MenuItem>
          );
          return items;
        })}
      </Menu>

      <Dialog open={Boolean(confirm)} onClose={() => !confirmBusy && setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>{confirm?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirm?.message}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirm(null)} disabled={confirmBusy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={confirm?.kind === 'reactivate' ? 'success' : 'error'}
            onClick={() => void handleConfirm()}
            disabled={confirmBusy}
          >
            {confirm?.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>

      <CustomerSafeDeleteDialog
        open={Boolean(deleteParty)}
        party={deleteParty}
        onClose={() => setDeleteParty(null)}
        onDone={(msg) => {
          showToast(msg);
          onRefresh?.();
        }}
        onError={(msg) => showToast(msg, 'error')}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity ?? 'success'} onClose={() => setToast(null)} sx={{ width: '100%' }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
