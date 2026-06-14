import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireParent } from '../middleware/auth';
import * as childService from '../services/childService';
import type { ModuleName, AccessLevel } from '../types/express';

const router = Router();
router.use(authenticate, requireParent);

router.post('/', async (req, res, next) => {
  try {
    const body = z
      .object({
        mobile_no: z.string(),
        name: z.string(),
        permissions: z.record(z.string()).optional(),
      })
      .parse(req.body);
    const result = await childService.createChild(
      req.dataOwnerId!,
      body.mobile_no,
      body.name,
      (body.permissions || {}) as Partial<Record<ModuleName, AccessLevel>>
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await childService.listChildren(req.dataOwnerId!));
  } catch (err) {
    next(err);
  }
});

router.put('/:id/permissions', async (req, res, next) => {
  try {
    const permissions = z.record(z.string()).parse(req.body.permissions);
    await childService.updatePermissions(
      req.dataOwnerId!,
      req.params.id,
      permissions as Partial<Record<ModuleName, AccessLevel>>
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await childService.deactivateChild(req.dataOwnerId!, req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/subscription', async (req, res, next) => {
  try {
    res.json(
      await childService.getSubscriptions(
        req.dataOwnerId!,
        req.query.child_id as string | undefined
      )
    );
  } catch (err) {
    next(err);
  }
});

router.post('/renew', async (req, res, next) => {
  try {
    const { child_id } = z.object({ child_id: z.string() }).parse(req.body);
    res.json(await childService.renewSubscription(req.dataOwnerId!, child_id));
  } catch (err) {
    next(err);
  }
});

export default router;
