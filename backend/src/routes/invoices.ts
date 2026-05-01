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
import { blockMobileAction, blockMobileUpdateDelete } from '../middleware/mutationPolicy';

const router = Router();

router.use(blockMobileUpdateDelete);

router.get('/', getInvoices);
router.get('/next-number', getNextInvoiceNumber);
router.get('/:id', getInvoice);
router.get('/:id/print', printInvoice);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);
router.post('/:id/cancel', blockMobileAction('invoice cancel'), cancelInvoice);
router.post('/:id/email', emailInvoice);

export default router;

