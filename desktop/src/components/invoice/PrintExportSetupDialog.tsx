import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import PreviewIcon from '@mui/icons-material/Preview';

import InvoiceTemplateThumbnail from './InvoiceTemplateThumbnail';
import { INVOICE_TEMPLATES, type InvoiceTemplateId } from '../../templates/invoice/invoiceTemplatesConfig';
import {
  getInvoicePrintLayout,
  getInvoiceTemplateId,
  loadCompanySettingsFromDisk,
  setInvoicePrintDefaults,
} from '../../services/companySettingsService';
import { downloadPDF, openPrintPreview, shareInvoiceOnWhatsApp } from '../../services/printService';

export type PrintExportAction = 'print' | 'download' | 'whatsapp';

export type PrintExportBuildInput = {
  templateId: InvoiceTemplateId;
  pageSize: string;
  orientation: string;
};

export type PrintExportBuildResult = {
  html: string;
  fileName: string;
  landscape: boolean;
};

type Props = {
  open: boolean;
  action: PrintExportAction;
  onClose: () => void;
  buildPackage: (input: PrintExportBuildInput) => PrintExportBuildResult | Promise<PrintExportBuildResult>;
  whatsAppMeta?: {
    invoiceNumber: string;
    invoiceDate: string;
    grandTotal: number;
    phone?: string;
  };
  /** Template/layout only — no print, download, or share. */
  applyOnly?: boolean;
  confirmLabel?: string;
  onApply?: (input: PrintExportBuildInput) => void;
};

const actionTitle: Record<PrintExportAction, string> = {
  print: 'Print Setup',
  download: 'Download PDF Setup',
  whatsapp: 'Share on WhatsApp',
};

const actionButton: Record<PrintExportAction, string> = {
  print: 'Print',
  download: 'Download PDF',
  whatsapp: 'Share',
};

export default function PrintExportSetupDialog({
  open,
  action,
  onClose,
  buildPackage,
  whatsAppMeta,
  applyOnly = false,
  confirmLabel,
  onApply,
}: Props) {
  const [templateId, setTemplateId] = useState<InvoiceTemplateId>('navy-gold');
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadCompanySettingsFromDisk().then(() => {
      const layout = getInvoicePrintLayout();
      setTemplateId(getInvoiceTemplateId());
      setPageSize(layout.pageSize);
      setOrientation(layout.orientation);
      setSetAsDefault(false);
      setPreviewHtml(null);
    });
  }, [open]);

  const landscape = orientation === 'landscape';

  const runBuild = useCallback(async () => {
    const built = await Promise.resolve(
      buildPackage({ templateId, pageSize, orientation })
    );
    return built;
  }, [buildPackage, templateId, pageSize, orientation]);

  const handlePreview = async () => {
    try {
      setBusy(true);
      const { html } = await runBuild();
      setPreviewHtml(html);
      await openPrintPreview(html);
    } catch (e) {
      console.error(e);
      setToast({ message: 'Preview failed. Please try again.', severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setBusy(true);
      const input: PrintExportBuildInput = { templateId, pageSize, orientation };

      if (setAsDefault) {
        const saveRes = await setInvoicePrintDefaults(templateId, pageSize, orientation);
        if (!saveRes.success) {
          setToast({
            message: saveRes.error || 'Save failed. Please try again.',
            severity: 'error',
          });
          return;
        }
        setToast({ message: 'Template saved successfully!', severity: 'success' });
      }

      if (applyOnly) {
        onApply?.(input);
        onClose();
        return;
      }

      if (action === 'whatsapp' && whatsAppMeta) {
        await shareInvoiceOnWhatsApp(
          whatsAppMeta.invoiceNumber,
          whatsAppMeta.invoiceDate,
          whatsAppMeta.grandTotal,
          whatsAppMeta.phone
        );
        onClose();
        return;
      }

      const { html, fileName } = await runBuild();
      if (action === 'print') {
        await openPrintPreview(html);
      } else if (action === 'download') {
        const path = await downloadPDF(html, fileName, landscape);
        if (path) {
          setToast({ message: `PDF saved to:\n${path}`, severity: 'success' });
        } else {
          setToast({ message: 'PDF save cancelled or unavailable.', severity: 'error' });
        }
      }
      onClose();
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Action failed. Please try again.';
      setToast({ message: msg, severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const title = useMemo(() => `Print / Export Setup — ${actionTitle[action]}`, [action]);

  return (
    <>
      <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Invoice Template
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {INVOICE_TEMPLATES.map((tpl) => (
              <Grid item xs={12} sm={4} key={tpl.id}>
                <InvoiceTemplateThumbnail
                  template={tpl}
                  selected={templateId === tpl.id}
                  onSelect={() => setTemplateId(tpl.id)}
                />
              </Grid>
            ))}
          </Grid>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Paper Size</InputLabel>
              <Select label="Paper Size" value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                <MenuItem value="A4">A4</MenuItem>
                <MenuItem value="A5">A5</MenuItem>
                <MenuItem value="THERMAL_80">Thermal 80mm</MenuItem>
                <MenuItem value="THERMAL_58">Thermal 58mm</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Orientation</InputLabel>
              <Select
                label="Orientation"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                disabled={pageSize.startsWith('THERMAL')}
              >
                <MenuItem value="portrait">Portrait</MenuItem>
                <MenuItem value="landscape">Landscape</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <FormControlLabel
            control={<Checkbox checked={setAsDefault} onChange={(e) => setSetAsDefault(e.target.checked)} />}
            label="Set as default template (saved to company settings.json)"
          />

          {action === 'whatsapp' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              WhatsApp opens with invoice summary. Use Download PDF in this dialog if you need a PDF file.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="outlined" startIcon={<PreviewIcon />} onClick={() => void handlePreview()} disabled={busy}>
            Preview
          </Button>
          <Button variant="contained" onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel || actionButton[action]}
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
