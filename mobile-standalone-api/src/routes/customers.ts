import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as crud from '../services/crudService';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('customers', 'read'), async (req, res, next) => {
  try {
    res.json(await crud.list(req.dataOwnerId!, 'customers', 'name'));
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('customers', 'add'), async (req, res, next) => {
  try {
    res.status(201).json(await crud.create(req.dataOwnerId!, 'customers', 'customer_id', req.body));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requirePermission('customers', 'edit'), async (req, res, next) => {
  try {
    res.json(await crud.update(req.dataOwnerId!, 'customers', 'customer_id', req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

export default router;
