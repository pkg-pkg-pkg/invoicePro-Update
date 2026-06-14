import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireParent } from '../middleware/auth';
import * as childService from '../services/childService';

const router = Router();
router.use(authenticate, requireParent);

router.post('/', async (req, res, next) => {
  try {
    const body = z
      .object({ mobile_no: z.string(), name: z.string() })
      .parse(req.body);
    const result = await childService.createChild(req.user!.user_id, body.mobile_no, body.name);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const rows = await childService.listChildren(req.user!.user_id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Static paths before /:id
router.get('/pending', async (req, res, next) => {
  try {
    const rows = await childService.getPendingChanges(req.user!.user_id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/approve', async (req, res, next) => {
  try {
    const { pending_ids } = z.object({ pending_ids: z.array(z.string()) }).parse(req.body);
    const count = await childService.approvePending(req.user!.user_id, pending_ids);
    res.json({ approved: count });
  } catch (err) {
    next(err);
  }
});

router.post('/reject', async (req, res, next) => {
  try {
    const { pending_ids } = z.object({ pending_ids: z.array(z.string()) }).parse(req.body);
    const count = await childService.rejectPending(req.user!.user_id, pending_ids);
    res.json({ rejected: count });
  } catch (err) {
    next(err);
  }
});

router.get('/subscription', async (req, res, next) => {
  try {
    const rows = await childService.getSubscriptionStatus(
      req.user!.user_id,
      req.query.child_id as string | undefined
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await childService.deactivateChild(req.user!.user_id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/renew', async (req, res, next) => {
  try {
    const { child_id } = z.object({ child_id: z.string() }).parse(req.body);
    const result = await childService.renewSubscription(req.user!.user_id, child_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
