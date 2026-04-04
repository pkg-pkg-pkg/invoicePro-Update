import { Router } from 'express';
import {
  uploadSync,
  downloadSync,
  getSyncStatus,
  resolveConflict,
  getSyncHistory,
} from '../controllers/sync';

const router = Router();

router.post('/upload', uploadSync);
router.get('/download', downloadSync);
router.get('/status', getSyncStatus);
router.post('/resolve-conflict', resolveConflict);
router.get('/history', getSyncHistory);

export default router;

