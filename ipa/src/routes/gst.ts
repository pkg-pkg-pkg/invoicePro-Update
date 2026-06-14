import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { emptyGstReport } from '../services/analyticsService';

const router = Router();
router.use(authenticate);

router.get('/gstr1', (req, res) => {
  res.json(emptyGstReport('GSTR-1', req.query.month as string, req.query.year as string));
});

router.get('/gstr2', (req, res) => {
  res.json(emptyGstReport('GSTR-2', req.query.month as string, req.query.year as string));
});

router.get('/gstr3b', (req, res) => {
  res.json(emptyGstReport('GSTR-3B', req.query.month as string, req.query.year as string));
});

router.get('/gstr9', (req, res) => {
  res.json({ ...emptyGstReport('GSTR-9'), annualSummary: [], monthlyReconciliation: [] });
});

router.get('/hsn-summary', (req, res) => {
  res.json({
    report: 'HSN Summary',
    from: req.query.from || '',
    to: req.query.to || '',
    rows: [],
    generatedAt: new Date().toISOString(),
  });
});

export default router;
