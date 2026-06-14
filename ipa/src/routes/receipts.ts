import { Router } from 'express';
import { authenticate, getDataOwnerId } from '../middleware/auth';
import * as data from '../services/dataService';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const rows = await data.listByUser('receipts', getDataOwnerId(req));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const row = await data.insertRecord('receipts', 'receipt_id', getDataOwnerId(req), req.body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

export default router;
