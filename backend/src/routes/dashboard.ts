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

// Primary sales analytics route
router.get('/sales-analytics', getSalesAnalytics);

// Added alias so frontend requests to /analytics will succeed
router.get('/analytics', getSalesAnalytics);

router.get('/outstanding', getOutstandingSummary);
router.get('/payable', getPayableSummary);
router.get('/recent-transactions', getRecentTransactions);

export default router;
