import { Router } from 'express';
import {
  getDashboardSummary,
  getSalesAnalytics,
  getOutstandingSummary,
  getPayableSummary,
  getRecentTransactions
} from '../controllers/dashboard';

const router = Router();

router.get('/summary', getDashboardSummary);
router.get('/sales-analytics', getSalesAnalytics);
router.get('/outstanding', getOutstandingSummary);
router.get('/payable', getPayableSummary);
router.get('/recent-transactions', getRecentTransactions);

export default router;

