import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { initOraclePool, closePool } from './db/oracle';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import invoiceRoutes from './routes/invoices';
import purchaseRoutes from './routes/purchase';
import customerRoutes from './routes/customers';
import vendorRoutes from './routes/vendors';
import itemRoutes from './routes/items';
import journalRoutes from './routes/journal';
import receiptRoutes from './routes/receipts';
import paymentRoutes from './routes/payments';
import ledgerRoutes from './routes/ledger';
import reportRoutes from './routes/reports';
import companyRoutes from './routes/company';
import childrenRoutes from './routes/children';

const app = express();

app.use(
  cors({
    origin: env.corsOrigins.length === 0 ? true : env.corsOrigins,
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json({ limit: '5mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 600 }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', system: 'mobile-standalone-api', port: env.port });
});

app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/children', childrenRoutes);

app.use(errorHandler);

async function start() {
  await initOraclePool();
  app.listen(env.port, () => {
    console.log(`Standalone Mobile API listening on port ${env.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start mobile-standalone-api:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});
