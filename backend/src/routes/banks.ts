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
import { blockMobileAction, blockMobileUpdateDelete } from '../middleware/mutationPolicy';

const router = Router();

router.use(blockMobileUpdateDelete);

router.get('/', getBankAccounts);
router.get('/summary', getBankSummary);
router.get('/:id', getBankAccount);
router.get('/:id/statement', getBankStatement);
router.post('/', createBankAccount);
router.put('/:id', updateBankAccount);
router.delete('/:id', deleteBankAccount);
router.post('/:id/reconcile', blockMobileAction('bank reconciliation'), reconcileBankAccount);

export default router;
