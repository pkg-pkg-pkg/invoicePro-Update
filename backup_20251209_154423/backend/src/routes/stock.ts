import { Router } from 'express';
import {
  getStockMovements,
  getStockSummary,
  adjustStock,
  getLowStockItems
} from '../controllers/stock';

const router = Router();

router.get('/movements', getStockMovements);
router.get('/summary', getStockSummary);
router.get('/low-stock', getLowStockItems);
router.post('/adjust', adjustStock);

export default router;

