import { Router } from 'express';
import {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger,
  getSupplierPayable,
  getPayableList
} from '../controllers/suppliers';
import { blockMobileUpdateDelete } from '../middleware/mutationPolicy';

const router = Router();

router.use(blockMobileUpdateDelete);

router.get('/', getSuppliers);
router.get('/payable', getPayableList);
router.get('/:id', getSupplier);
router.get('/:id/ledger', getSupplierLedger);
router.get('/:id/payable', getSupplierPayable);
router.post('/', createSupplier);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

export default router;

