import { Router } from 'express';
import os from 'os';
import { authenticateFirebaseSuperAdmin } from '../middleware/firebaseAuth';
import { query, useSqlite } from '../db';

const router = Router();

async function safeCount(table: string): Promise<number | null> {
  try {
    const rows = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`);
    return Number(rows[0]?.c ?? 0);
  } catch {
    return null;
  }
}

router.get('/diagnostic', authenticateFirebaseSuperAdmin, async (_req, res) => {
  const mem = process.memoryUsage();
  const [users, customers, items, invoices, syncLog] = await Promise.all([
    safeCount('users'),
    safeCount('customers'),
    safeCount('items'),
    safeCount('invoices'),
    safeCount('sync_log'),
  ]);

  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
    host: {
      hostname: os.hostname(),
      platform: process.platform,
      release: os.release(),
    },
    database: {
      mode: useSqlite() ? 'sqlite' : 'oracle',
      counts: { users, customers, items, invoices, syncLog },
    },
    sync: {
      note: 'IPA stores synced records; desktop owns outbound queue.',
    },
    recentErrors: [],
  });
});

export default router;
