import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { initPool, closePool, useSqlite } from './db';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import syncRoutes from './routes/sync';
import invoiceRoutes from './routes/invoices';
import customerRoutes from './routes/customers';
import itemRoutes from './routes/items';
import ledgerRoutes from './routes/ledger';
import receiptRoutes from './routes/receipts';
import reportRoutes from './routes/reports';
import childrenRoutes from './routes/children';
import dashboardRoutes from './routes/dashboard';
import daybookRoutes from './routes/daybook';
import voucherRoutes from './routes/vouchers';
import partyRoutes from './routes/parties';
import ledgerListRoutes from './routes/ledgers';
import gstRoutes from './routes/gst';
import superadminRoutes from './routes/superadmin';

const app = express();

app.use(
  cors({
    origin: env.corsOrigins.length === 0 ? true : env.corsOrigins,
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json({ limit: '5mb' }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    system: 'invoicepro-api',
    port: env.port,
    database: useSqlite() ? 'sqlite' : 'oracle',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/daybook', daybookRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/ledgers', ledgerListRoutes);
app.use('/api/gst', gstRoutes);
app.use('/api/superadmin', superadminRoutes);

app.use(errorHandler);

async function start() {
  await initPool();
  app.listen(env.port, () => {
    const mode = useSqlite() ? 'SQLite (local dev)' : 'Oracle ADB';
    console.log(`Invoice Pro Middleware API listening on port ${env.port} [${mode}]`);
  });
}

start().catch((err) => {
  console.error('Failed to start invoicepro-api:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});
