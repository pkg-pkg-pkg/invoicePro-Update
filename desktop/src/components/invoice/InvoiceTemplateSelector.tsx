import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import PreviewIcon from '@mui/icons-material/Preview';

import InvoiceTemplateThumbnail from './InvoiceTemplateThumbnail';
import {
  INVOICE_TEMPLATES,
  type InvoiceTemplateId,
} from '../../templates/invoice/invoiceTemplatesConfig';
import { buildSampleInvoiceHtml } from '../../templates/invoice/invoiceTemplateRenderer';
import {
  getInvoiceTemplateId,
  loadCompanySettingsFromDisk,
  setInvoiceTemplate,
} from '../../services/companySettingsService';
import { openPrintPreview } from '../../services/printService';

type Props = {
  embedded?: boolean;
  value?: InvoiceTemplateId;
  onChange?: (id: InvoiceTemplateId) => void;
  showSaveButton?: boolean;
  onSaved?: () => void;
};

export default function InvoiceTemplateSelector({
  embedded = false,
  value,
  onChange,
  showSaveButton = true,
  onSaved,
}: Props) {
  const [selected, setSelected] = useState<InvoiceTemplateId>(value || getInvoiceTemplateId());
  const [savedId, setSavedId] = useState<InvoiceTemplateId>(getInvoiceTemplateId());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    void loadCompanySettingsFromDisk().then(() => {
      const id = getInvoiceTemplateId();
      setSavedId(id);
      if (!value) setSelected(id);
    });
  }, [value]);

  useEffect(() => {
    if (value) setSelected(value);
  }, [value]);

  const pick = useCallback(
    (id: InvoiceTemplateId) => {
      setSelected(id);
      onChange?.(id);
    },
    [onChange]
  );

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await setInvoiceTemplate(selected);
      if (!result.success) {
        setToast({
          message: result.error || 'Save failed. Please try again.',
          severity: 'error',
        });
        return;
      }
      setSavedId(selected);
      setToast({ message: 'Template saved successfully!', severity: 'success' });
      onSaved?.();
    } catch (e) {
      console.error(e);
      setToast({ message: 'Save failed. Please try again.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewCard = (id: InvoiceTemplateId) => {
    void buildSampleInvoiceHtml(id).then((html) => {
      setPreviewHtml(html);
      setPreviewOpen(true);
    });
  };

  const openFullPreview = async () => {
    if (previewHtml) await openPrintPreview(previewHtml);
  };

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Invoice Template
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Default template for this company (saved in <code>settings.json</code>). Print / PDF dialogs use this
        unless you pick another template there.
      </Typography>

      <Grid container spacing={2}>
        {INVOICE_TEMPLATES.map((tpl) => (
          <Grid item xs={12} sm={4} key={tpl.id}>
            <InvoiceTemplateThumbnail
              template={tpl}
              selected={selected === tpl.id}
              onSelect={() => pick(tpl.id)}
            />
            <Stack direction="row" spacing={1} sx={{ mt: 0.5, px: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                {tpl.description}
              </Typography>
              <Button size="small" onClick={() => handlePreviewCard(tpl.id)}>
                Preview
              </Button>
            </Stack>
          </Grid>
        ))}
      </Grid>

      {showSaveButton && !embedded && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }} alignItems={{ sm: 'center' }}>
          <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save Template Preference'}
          </Button>
        </Stack>
      )}

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Template Preview — {INVOICE_TEMPLATES.find((t) => t.id === selected)?.name}</DialogTitle>
        <DialogContent dividers sx={{ p: 0, height: 480 }}>
          {previewHtml ? (
            <iframe title="Invoice template preview" srcDoc={previewHtml} style={{ width: '100%', height: '100%', border: 0 }} />
          ) : (
            <Alert severity="info" sx={{ m: 2 }}>
              No preview available.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          <Button variant="contained" startIcon={<PreviewIcon />} onClick={() => void openFullPreview()}>
            Open in Print Preview
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity} onClose={() => setToast(null)} sx={{ width: '100%' }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
