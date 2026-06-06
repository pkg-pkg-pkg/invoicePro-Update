import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { APP_DISPLAY_NAME } from '@/constants/appBranding';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function AppQuitDialog({ open, onClose, onConfirm }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="app-quit-title"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="app-quit-title" fontWeight={700}>
        Exit {APP_DISPLAY_NAME}?
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to close the application?
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          No
        </Button>
        <Button onClick={onConfirm} variant="contained" color="error" autoFocus>
          Yes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
