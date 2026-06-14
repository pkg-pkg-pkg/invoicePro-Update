import {

  Button,

  Dialog,

  DialogActions,

  DialogContent,

  DialogContentText,

  DialogTitle,

} from '@mui/material';



type Props = {

  open: boolean;

  barcode: string;

  onConfirm: () => void;

  onCancel: () => void;

};



export function ItemNotFoundDialog({ open, barcode, onConfirm, onCancel }: Props) {

  return (

    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>

      <DialogTitle>Item not found</DialogTitle>

      <DialogContent>

        <DialogContentText>

          No item matches barcode <strong>{barcode}</strong>.

        </DialogContentText>

      </DialogContent>

      <DialogActions>

        <Button onClick={onCancel}>Cancel</Button>

        <Button variant="contained" onClick={onConfirm}>

          Create Item

        </Button>

      </DialogActions>

    </Dialog>

  );

}


