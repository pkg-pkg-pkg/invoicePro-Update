import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as reports from '../services/reportService';

const router = Router();
router.use(authenticate);

router.get('/:account_id', requirePermission('ledger', 'read'), async (req, res, next) => {
  try {
    res.json(await reports.accountLedger(req.dataOwnerId!, req.params.account_id));
  } catch (err) {
    next(err);
  }
});

export default router;
