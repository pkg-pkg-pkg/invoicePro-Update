import { Router } from 'express';
import {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentSummary,
} from '../controllers/payments';
import { blockMobileUpdateDelete } from '../middleware/mutationPolicy';

const router = Router();

router.use(blockMobileUpdateDelete);

router.get('/', getPayments);
router.get('/summary', getPaymentSummary);
router.get('/:id', getPayment);
router.post('/', createPayment);
router.put('/:id', updatePayment);
router.delete('/:id', deletePayment);

export default router;
