import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';

type Props = {
  open: boolean;
  title?: string;
  previewJson: string;
  onClose: () => void;
  onConfirmSend?: () => void;
  confirmLabel?: string;
  readOnly?: boolean;
};

export default function DiagnosticsPreviewDialog({
  open,
  title = 'Diagnostics payload preview',
  previewJson,
  onClose,
  onConfirmSend,
  confirmLabel = 'Send with diagnostics',
  readOnly = false,
}: Props) {
  const lineCount = useMemo(() => previewJson.split('\n').length, [previewJson]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{title}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Review exactly what will be sent. No customer, ledger, invoice, GST, mobile, or financial records
          are included.
        </Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.5,
            bgcolor: 'grey.100',
            borderRadius: 1,
            fontSize: '0.75rem',
            maxHeight: 420,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {previewJson}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {lineCount} lines · audit preview
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
        {!readOnly && onConfirmSend ? (
          <Button variant="contained" onClick={onConfirmSend}>
            {confirmLabel}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
