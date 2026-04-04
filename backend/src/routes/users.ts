import { Router } from 'express';
import { getUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/users';
import { authorize } from '../middleware/auth';

const router = Router();

router.get('/', authorize('ADMIN', 'MANAGER'), getUsers);
router.get('/:id', getUser);
router.post('/', authorize('ADMIN', 'MANAGER'), createUser);
router.put('/:id', authorize('ADMIN', 'MANAGER'), updateUser);
router.delete('/:id', authorize('ADMIN'), deleteUser);

export default router;

