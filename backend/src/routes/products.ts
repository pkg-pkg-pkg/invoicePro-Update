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
import { blockMobileAction, blockMobileUpdateDelete } from '../middleware/mutationPolicy';

const router = Router();

router.use(blockMobileUpdateDelete);

router.get('/', getProducts);
router.get('/low-stock', getLowStockProducts);
router.get('/categories', getCategories);
router.get('/barcode/:barcode', getProductByBarcode);
router.get('/:id', getProduct);
router.post('/', createProduct);
router.post('/bulk-update-stock', blockMobileAction('bulk stock update'), bulkUpdateStock);
router.post('/bulk-import', bulkImport);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;

