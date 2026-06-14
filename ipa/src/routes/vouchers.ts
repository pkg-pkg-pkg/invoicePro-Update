import { Router } from 'express';
import { authenticate, getDataOwnerId } from '../middleware/auth';
import { listVouchersByType } from '../services/analyticsService';
import * as data from '../services/dataService';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const type = req.query.type as string | undefined;
    const rows = await listVouchersByType(getDataOwnerId(req), type);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const userId = getDataOwnerId(req);
    const body = req.body as Record<string, unknown>;
    const voucherType = String(body.voucherType || body.type || 'voucher');
    const payload = JSON.stringify(body);
    const row = await data.insertRecord(
      'vouchers',
      'voucher_id',
      userId,
      { record_type: voucherType, payload },
      'mobile'
    );
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

export default router;
