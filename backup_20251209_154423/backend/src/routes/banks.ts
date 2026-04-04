import { Router } from 'express';
import {
  getBankAccounts,
  getBankAccount,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getBankStatement,
  reconcileBankAccount,
  getBankSummary,
} from '../controllers/banks';

const router = Router();

router.get('/', getBankAccounts);
router.get('/summary', getBankSummary);
router.get('/:id', getBankAccount);
router.get('/:id/statement', getBankStatement);
router.post('/', createBankAccount);
router.put('/:id', updateBankAccount);
router.delete('/:id', deleteBankAccount);
router.post('/:id/reconcile', reconcileBankAccount);

export default router;
