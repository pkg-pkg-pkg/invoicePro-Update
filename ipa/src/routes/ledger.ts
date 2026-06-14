import { Router } from 'express';
import { authenticate, getDataOwnerId } from '../middleware/auth';
import * as data from '../services/dataService';

const router = Router();
router.use(authenticate);

router.get('/:party_id', async (req, res, next) => {
  try {
    const rows = await data.getPartyLedger(getDataOwnerId(req), req.params.party_id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
