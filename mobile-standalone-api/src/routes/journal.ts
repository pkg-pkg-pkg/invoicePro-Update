import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as crud from '../services/crudService';

const router = Router();
router.use(authenticate);

router.post('/', requirePermission('ledger', 'add'), async (req, res, next) => {
  try {
    res.status(201).json(
      await crud.create(req.dataOwnerId!, 'vouchers', 'voucher_id', { ...req.body, voucher_type: 'journal' })
    );
  } catch (err) {
    next(err);
  }
});

export default router;
