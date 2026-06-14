import { Router } from 'express';
import oracledb from 'oracledb';
import { authenticate, requireParent } from '../middleware/auth';
import { withConnection } from '../db/oracle';

const router = Router();
router.use(authenticate, requireParent);

router.get('/', async (req, res, next) => {
  try {
    const row = await withConnection(req.dataOwnerId!, async (conn) => {
      const rs = await conn.execute(
        `SELECT user_id, name, email, gstin, company_name, financial_year FROM users WHERE user_id = :id`,
        { id: req.dataOwnerId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return (rs.rows as unknown[])?.[0] || null;
    });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const { name, email, gstin, company_name, financial_year } = req.body;
    await withConnection(req.dataOwnerId!, async (conn) => {
      await conn.execute(
        `UPDATE users SET name = :name, email = :email, gstin = :gstin,
         company_name = :company, financial_year = :fy WHERE user_id = :id`,
        {
          name,
          email,
          gstin,
          company: company_name,
          fy: financial_year,
          id: req.dataOwnerId,
        },
        { autoCommit: true }
      );
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
