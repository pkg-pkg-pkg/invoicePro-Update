import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as crud from '../services/crudService';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('items', 'read'), async (req, res, next) => {
  try {
    res.json(await crud.list(req.dataOwnerId!, 'items', 'name'));
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('items', 'add'), async (req, res, next) => {
  try {
    res.status(201).json(await crud.create(req.dataOwnerId!, 'items', 'item_id', req.body));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requirePermission('items', 'edit'), async (req, res, next) => {
  try {
    res.json(await crud.update(req.dataOwnerId!, 'items', 'item_id', req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

export default router;
