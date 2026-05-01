import { Router } from 'express';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categories';
import { blockMobileUpdateDelete } from '../middleware/mutationPolicy';

const router = Router();

router.use(blockMobileUpdateDelete);

router.get('/', getCategories);
router.get('/:id', getCategory);
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;

