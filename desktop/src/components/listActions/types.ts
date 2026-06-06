import type { SalesDocumentRow } from '../../types/salesDocuments';
import type { PurchaseDocKind } from '../../types/purchaseDocuments';
import type { SalesDocKind } from '../../types/salesDocuments';
import type { Party } from '../../types/party';
import type { InventoryItem } from '../../types/masters';

export type DocumentListKind =
  | SalesDocKind
  | `purchase-${PurchaseDocKind}`
  | 'customers'
  | 'inventory-items';

export type RowActionId =
  | 'openEdit'
  | 'printPdf'
  | 'sendWhatsapp'
  | 'sendEmail'
  | 'recordPayment'
  | 'convertToInvoice'
  | 'convertToSalesOrder'
  | 'convertToTaxInvoice'
  | 'createDispatchNote'
  | 'applyToInvoice'
  | 'applyToBill'
  | 'convertToPurchaseBill'
  | 'pauseRecurring'
  | 'resumeRecurring'
  | 'clone'
  | 'cancel'
  | 'delete'
  | 'viewStatement'
  | 'newTransaction'
  | 'adjustStock'
  | 'markInactive';

export type DocumentActionRow = SalesDocumentRow & {
  source?: 'voucher' | 'pipeline' | 'expense';
};

export type ActionContext =
  | {
      type: 'document';
      row: DocumentActionRow;
      listKind: DocumentListKind;
      title: string;
    }
  | {
      type: 'customer';
      party: Party;
    }
  | {
      type: 'inventory';
      item: InventoryItem;
      canManage: boolean;
    };

export type ConfirmKind = 'delete' | 'cancel';

export type PendingConfirm = {
  kind: ConfirmKind;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};
