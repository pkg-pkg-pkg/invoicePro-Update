import { Router } from 'express';
import { z } from 'zod';
import { authenticate, getDataOwnerId } from '../middleware/auth';
import { pushDeltas, fetchSince, mobilePushDelta, type DeltaRecord } from '../services/syncService';

const router = Router();

const deltaSchema = z.object({
  record_type: z.string(),
  record_id: z.string(),
  action: z.enum(['insert', 'update', 'delete']),
  data: z.record(z.unknown()),
  timestamp: z.string(),
  device_id: z.string(),
  user_id: z.string(),
});

router.post('/push', async (req, res, next) => {
  try {
    const authHeader = String(req.headers.authorization || '');
    const jwtPrefix = authHeader.startsWith('Bearer ') ? authHeader.slice(7, 27) : '(none)';
    const rawDeltas = req.body.deltas || req.body;
    const count = Array.isArray(rawDeltas) ? rawDeltas.length : 0;
    console.log(
      `[ipa/sync] POST /push deltas=${count} auth=${jwtPrefix}${authHeader.length > 27 ? '…' : ''}`
    );

    const deltas = z.array(deltaSchema).parse(rawDeltas);
    if (deltas[0]) {
      console.log(
        `[ipa/sync] first delta type=${deltas[0].record_type} id=${deltas[0].record_id} user=${deltas[0].user_id}`
      );
    }

    const result = await pushDeltas(deltas as DeltaRecord[]);
    console.log(`[ipa/sync] push accepted=${result.accepted} skipped=${result.skipped}`);
    res.json(result);
  } catch (err) {
    console.warn('[ipa/sync] push error:', err);
    next(err);
  }
});

router.get('/fetch', authenticate, async (req, res, next) => {
  try {
    const userId = getDataOwnerId(req);
    const lastSyncAt = req.query.last_sync_at as string | undefined;
    const data = await fetchSince(userId, lastSyncAt);
    res.json({ synced_at: new Date().toISOString(), data });
  } catch (err) {
    next(err);
  }
});

router.post('/mobile-push', authenticate, async (req, res, next) => {
  try {
    const delta = deltaSchema.parse(req.body);
    const user = req.user!;
    const ownerId = getDataOwnerId(req);
    const payload = { ...delta, user_id: ownerId } as DeltaRecord;

    const result = await mobilePushDelta(
      payload,
      Boolean(user.is_child),
      user.child_id,
      user.parent_user_id
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
