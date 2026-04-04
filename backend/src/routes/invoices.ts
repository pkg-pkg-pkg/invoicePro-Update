import { Router } from 'express';
import {
  getInvoices,
  getInvoice,
  getNextInvoiceNumber,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  cancelInvoice,
  printInvoice,
  emailInvoice
} from '../controllers/invoices';

const router = Router();

router.get('/', getInvoices);
router.get('/next-number', getNextInvoiceNumber);
router.get('/:id', getInvoice);
router.get('/:id/print', printInvoice);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);
router.post('/:id/cancel', cancelInvoice);
router.post('/:id/email', emailInvoice);

export default router;

