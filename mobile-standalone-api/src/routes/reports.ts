import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as reports from '../services/reportService';

const router = Router();
router.use(authenticate);

router.get('/pl', requirePermission('reports', 'read'), async (req, res, next) => {
  try {
    res.json(await reports.profitAndLoss(req.dataOwnerId!));
  } catch (err) {
    next(err);
  }
});

router.get('/balance-sheet', requirePermission('reports', 'read'), async (req, res, next) => {
  try {
    res.json(await reports.balanceSheet(req.dataOwnerId!));
  } catch (err) {
    next(err);
  }
});

router.get('/trial-balance', requirePermission('reports', 'read'), async (req, res, next) => {
  try {
    res.json(await reports.trialBalance(req.dataOwnerId!));
  } catch (err) {
    next(err);
  }
});

router.get('/gstr1', requirePermission('reports', 'read'), async (req, res, next) => {
  try {
    res.json(await reports.gstr1Summary(req.dataOwnerId!));
  } catch (err) {
    next(err);
  }
});

router.get('/outstanding', requirePermission('reports', 'read'), async (req, res, next) => {
  try {
    res.json(await reports.outstanding(req.dataOwnerId!));
  } catch (err) {
    next(err);
  }
});

export default router;
