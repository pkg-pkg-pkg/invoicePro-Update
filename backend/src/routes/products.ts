import { Router } from 'express';
import {
  getProducts,
  getProduct,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  getCategories,
  bulkUpdateStock,
  bulkImport
} from '../controllers/products';

const router = Router();

router.get('/', getProducts);
router.get('/low-stock', getLowStockProducts);
router.get('/categories', getCategories);
router.get('/barcode/:barcode', getProductByBarcode);
router.get('/:id', getProduct);
router.post('/', createProduct);
router.post('/bulk-update-stock', bulkUpdateStock);
router.post('/bulk-import', bulkImport);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;

