import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Snackbar,
} from '@mui/material';

import type { InvoicePaperSize } from '../../templates/invoice/invoiceTemplatesConfig';
import {
  type PrintBuildInput,
  type PrintBuildResult,
  type PrintExportAction,
  runInvoiceDownloadWithPaperSize,
} from '../../services/invoicePrintFlow';

export type { PrintExportAction, PrintBuildInput, PrintBuildResult };

type Props = {
  open: boolean;
  action: PrintExportAction;
  onClose: () => void;
  buildPackage: (input: PrintBuildInput) => PrintBuildResult | Promise<PrintBuildResult>;
};

export default function PrintExportSetupDialog({ open, action, onClose, buildPackage }: Props) {
  const [pageSize, setPageSize] = useState<InvoicePaperSize>('A4');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (open) setPageSize('A4');
  }, [open]);

  const handleConfirm = async () => {
    if (action !== 'download') {
      onClose();
      return;
    }
    try {
      setBusy(true);
      const result = await runInvoiceDownloadWithPaperSize({ pageSize, buildPackage });
      if (result.path) {
        setToast({ message: `PDF saved to:\n${result.path}`, severity: 'success' });
        onClose();
      } else {
        setToast({ message: 'PDF save cancelled or unavailable.', severity: 'error' });
      }
    } catch (e) {
      console.error(e);
      setToast({
        message: e instanceof Error ? e.message : 'Could not save PDF.',
        severity: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open && action === 'download'} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
        <DialogTitle>Save as PDF</DialogTitle>
        <DialogContent dividers>
          <FormControl component="fieldset" fullWidth>
            <RadioGroup
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as InvoicePaperSize)}
            >
              <FormControlLabel value="A4" control={<Radio />} label="A4 (210 × 297 mm)" />
              <FormControlLabel value="A5" control={<Radio />} label="A5 (148 × 210 mm)" />
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? 'Saving…' : 'Save PDF'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity} onClose={() => setToast(null)} sx={{ width: '100%' }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
