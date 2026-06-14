import { Router } from 'express';
import { authenticate, getDataOwnerId } from '../middleware/auth';
import { getDashboardSummary } from '../services/analyticsService';

const router = Router();
router.use(authenticate);

router.get('/summary', async (req, res, next) => {
  try {
    const summary = await getDashboardSummary(getDataOwnerId(req));
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;
