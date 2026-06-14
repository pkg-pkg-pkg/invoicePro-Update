import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

type Props = {
  open: boolean;
  version: string;
  notes: string;
  onAcknowledge: () => void;
};

export default function ReleaseNotesDialog({ open, version, notes, onAcknowledge }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onAcknowledge}
      maxWidth="sm"
      fullWidth
      aria-labelledby="release-notes-dialog-title"
    >
      <DialogTitle id="release-notes-dialog-title">
        What&apos;s included in v{version}
      </DialogTitle>
      <DialogContent dividers>
        <Typography
          variant="body2"
          component="div"
          sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary', lineHeight: 1.65 }}
        >
          {notes}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 2, py: 1.5 }}>
        <Button color="inherit" onClick={onAcknowledge}>
          Don&apos;t show again for this version
        </Button>
        <Button variant="contained" onClick={onAcknowledge}>
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
}
