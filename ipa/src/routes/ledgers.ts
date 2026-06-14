import { Router } from 'express';
import { authenticate, getDataOwnerId } from '../middleware/auth';
import { listLedgerAccounts } from '../services/analyticsService';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const rows = await listLedgerAccounts(getDataOwnerId(req));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
