import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PartyForm from '../pages/Parties/PartyForm';
import { Party } from '../types/party';

type PartyMasterDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (party: Party) => void;
};

/**
 * Party Master as a modal (e.g. from Sales Voucher) — does not navigate away from the voucher.
 */
export function PartyMasterDialog({ open, onClose, onSaved }: PartyMasterDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Typography variant="h6" component="span">
          New Party (Party Master)
        </Typography>
        <IconButton aria-label="close" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        <PartyForm
          embedded
          vendorMode={false}
          onSaved={(party) => {
            onSaved(party);
            onClose();
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

export default PartyMasterDialog;
