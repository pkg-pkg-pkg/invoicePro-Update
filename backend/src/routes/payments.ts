import { Router } from 'express';
import {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentSummary,
} from '../controllers/payments';

const router = Router();

router.get('/', getPayments);
router.get('/summary', getPaymentSummary);
router.get('/:id', getPayment);
router.post('/', createPayment);
router.put('/:id', updatePayment);
router.delete('/:id', deletePayment);

export default router;
