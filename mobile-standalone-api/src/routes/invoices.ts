import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as crud from '../services/crudService';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('sales', 'read'), async (req, res, next) => {
  try {
    const rows = await crud.list(req.dataOwnerId!, 'sales_invoices', 'invoice_date');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requirePermission('sales', 'read'), async (req, res, next) => {
  try {
    const row = await crud.getById(req.dataOwnerId!, 'sales_invoices', 'invoice_id', req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('sales', 'add'), async (req, res, next) => {
  try {
    const row = await crud.create(req.dataOwnerId!, 'sales_invoices', 'invoice_id', {
      ...req.body,
      updated_at: new Date(),
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requirePermission('sales', 'edit'), async (req, res, next) => {
  try {
    const row = await crud.update(req.dataOwnerId!, 'sales_invoices', 'invoice_id', req.params.id, {
      ...req.body,
      updated_at: new Date(),
    });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requirePermission('sales', 'delete'), async (req, res, next) => {
  try {
    await crud.remove(req.dataOwnerId!, 'sales_invoices', 'invoice_id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
