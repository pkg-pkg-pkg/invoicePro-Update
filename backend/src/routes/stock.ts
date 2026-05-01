import { Router } from 'express';
import {
  getStockMovements,
  getStockSummary,
  adjustStock,
  getLowStockItems
} from '../controllers/stock';
import { blockMobileAction } from '../middleware/mutationPolicy';

const router = Router();

router.get('/movements', getStockMovements);
router.get('/summary', getStockSummary);
router.get('/low-stock', getLowStockItems);
router.post('/adjust', blockMobileAction('stock adjustment'), adjustStock);

export default router;

