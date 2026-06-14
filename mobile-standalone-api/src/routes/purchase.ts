import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as crud from '../services/crudService';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('purchase', 'read'), async (req, res, next) => {
  try {
    res.json(await crud.list(req.dataOwnerId!, 'purchase_invoices'));
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('purchase', 'add'), async (req, res, next) => {
  try {
    res.status(201).json(await crud.create(req.dataOwnerId!, 'purchase_invoices', 'purchase_id', req.body));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requirePermission('purchase', 'edit'), async (req, res, next) => {
  try {
    res.json(await crud.update(req.dataOwnerId!, 'purchase_invoices', 'purchase_id', req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requirePermission('purchase', 'delete'), async (req, res, next) => {
  try {
    await crud.remove(req.dataOwnerId!, 'purchase_invoices', 'purchase_id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
