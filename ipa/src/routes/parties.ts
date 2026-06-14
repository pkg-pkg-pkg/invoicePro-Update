import { Router } from 'express';
import { authenticate, getDataOwnerId } from '../middleware/auth';
import * as data from '../services/dataService';
import { withConnection, OUT_FORMAT_OBJECT } from '../db';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const userId = getDataOwnerId(req);
    const type = String(req.query.type || 'customer').toLowerCase();
    const rows: Record<string, unknown>[] = [];

    if (type === 'customer' || type === 'all') {
      const customers = await data.listByUser('customers', userId);
      for (const row of customers as Record<string, unknown>[]) {
        rows.push({ ...row, partyType: 'customer' });
      }
    }

    if (type === 'supplier' || type === 'all') {
      try {
        const suppliers = await withConnection(async (conn) => {
          const rs = await conn.execute(
            `SELECT party_id, record_type, payload, updated_at FROM parties
             WHERE user_id = :userId AND record_type IN ('supplier', 'SUPPLIER')`,
            { userId },
            { outFormat: OUT_FORMAT_OBJECT }
          );
          return (rs.rows as Record<string, unknown>[]) || [];
        });
        for (const row of suppliers) {
          let payload: Record<string, unknown> = {};
          try {
            payload = JSON.parse(String(row.PAYLOAD || '{}')) as Record<string, unknown>;
          } catch {
            payload = {};
          }
          rows.push({
            customer_id: row.PARTY_ID,
            name: payload.name || payload.partyName,
            gstin: payload.gstin,
            mobile: payload.mobile || payload.phone,
            email: payload.email,
            partyType: 'supplier',
            ...payload,
          });
        }
      } catch {
        // parties table optional on Oracle
      }
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const userId = getDataOwnerId(req);
    const body = req.body as Record<string, unknown>;
    const partyType = String(body.partyType || body.type || 'customer').toLowerCase();

    if (partyType === 'supplier') {
      const row = await data.insertRecord(
        'parties',
        'party_id',
        userId,
        { record_type: 'supplier', payload: JSON.stringify(body) },
        'mobile'
      );
      res.status(201).json(row);
      return;
    }

    const row = await data.insertRecord('customers', 'customer_id', userId, body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/ledger', async (req, res, next) => {
  try {
    const rows = await data.getPartyLedger(getDataOwnerId(req), req.params.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
