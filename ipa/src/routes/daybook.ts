import { Router } from 'express';
import { authenticate, getDataOwnerId } from '../middleware/auth';
import { getDayBook } from '../services/analyticsService';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const result = await getDayBook(getDataOwnerId(req), {
      date: req.query.date as string | undefined,
      type: req.query.type as string | undefined,
      party: req.query.party as string | undefined,
      amount: req.query.amount as string | undefined,
      showDeleted: req.query.showDeleted === 'true',
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
