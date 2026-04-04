import { Router } from 'express';
import {
  getGSTR1,
  getGSTR2,
  getGSTR3B,
  getGSTR9,
  exportGSTR1,
  exportGSTR2,
  generateEwayBill,
  getHSNSummary
} from '../controllers/gst';

const router = Router();

router.get('/gstr1', getGSTR1);
router.get('/gstr2', getGSTR2);
router.get('/gstr3b', getGSTR3B);
router.get('/gstr9', getGSTR9);
router.get('/gstr1/export', exportGSTR1);
router.get('/gstr2/export', exportGSTR2);
router.get('/hsn-summary', getHSNSummary);
router.post('/eway-bill', generateEwayBill);

export default router;

