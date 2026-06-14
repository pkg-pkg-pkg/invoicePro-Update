import { ItemFormModalStandalone } from './items/ItemFormModal';
import { InventoryItem } from '../types/masters';

type InventoryItemMasterDialogProps = {
  open: boolean;
  initialBarcode?: string;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
};

/** Full inventory item form inside a dialog (e.g. from Sales/Purchase voucher line). */
export function InventoryItemMasterDialog({ open, initialBarcode, onClose, onSaved }: InventoryItemMasterDialogProps) {
  return (
    <ItemFormModalStandalone
      open={open}
      itemId={null}
      initialBarcode={initialBarcode}
      nested
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

export default InventoryItemMasterDialog;
