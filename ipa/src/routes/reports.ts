import { Router } from 'express';
import { authenticate, getDataOwnerId } from '../middleware/auth';
import * as data from '../services/dataService';

const router = Router();
router.use(authenticate);

router.get('/sales', async (req, res, next) => {
  try {
    const rows = await data.getSalesReport(
      getDataOwnerId(req),
      req.query.from as string,
      req.query.to as string
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/outstanding', async (req, res, next) => {
  try {
    const rows = await data.getOutstandingReport(getDataOwnerId(req));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/sales-summary', async (req, res, next) => {
  try {
    const rows = await data.getSalesReport(
      getDataOwnerId(req),
      req.query.from as string,
      req.query.to as string
    );
    res.json({ report: 'sales-summary', rows });
  } catch (err) {
    next(err);
  }
});

router.get('/purchase-summary', (req, res) => {
  res.json({ report: 'purchase-summary', rows: [], from: req.query.from, to: req.query.to });
});

router.get('/stock-summary', (_req, res) => {
  res.json({ report: 'stock-summary', rows: [] });
});

router.get('/pl', (req, res) => {
  res.json({ report: 'pl', rows: [], from: req.query.from, to: req.query.to });
});

router.get('/balance-sheet', (req, res) => {
  res.json({ report: 'balance-sheet', date: req.query.date, rows: [] });
});

router.get('/trial-balance', (req, res) => {
  res.json({ report: 'trial-balance', date: req.query.date, rows: [] });
});

export default router;
