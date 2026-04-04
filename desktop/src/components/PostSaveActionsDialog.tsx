import { FC } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, Box } from '@mui/material';
import { Print as PrintIcon, GetApp as DownloadIcon, WhatsApp as WhatsAppIcon, Close as CloseIcon } from '@mui/icons-material';

interface PostSaveActionsDialogProps {
  open: boolean;
  invoiceNumber: string;
  onClose: () => void;
  onPrint: () => void;
  onDownloadPDF: () => void;
  onShareWhatsApp: () => void;
}

const PostSaveActionsDialog: FC<PostSaveActionsDialogProps> = ({
  open,
  invoiceNumber,
  onClose,
  onPrint,
  onDownloadPDF,
  onShareWhatsApp,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Invoice Saved Successfully!</Typography>
          <CloseIcon sx={{ cursor: 'pointer' }} onClick={onClose} />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Invoice {invoiceNumber} has been saved. What would you like to do next?
        </Typography>
        <Stack spacing={2} sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            size="large"
            startIcon={<PrintIcon />}
            onClick={() => {
              onPrint();
              onClose();
            }}
            fullWidth
          >
            Print Invoice
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<DownloadIcon />}
            onClick={() => {
              onDownloadPDF();
              onClose();
            }}
            fullWidth
          >
            Download as PDF
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<WhatsAppIcon />}
            onClick={() => {
              onShareWhatsApp();
              onClose();
            }}
            fullWidth
            sx={{ color: '#25D366', borderColor: '#25D366', '&:hover': { borderColor: '#128C7E', bgcolor: 'rgba(37, 211, 102, 0.04)' } }}
          >
            Share on WhatsApp
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PostSaveActionsDialog;
