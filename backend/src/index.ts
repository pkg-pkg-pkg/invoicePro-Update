import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import companyRoutes from './routes/company';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import customerRoutes from './routes/customers';
import supplierRoutes from './routes/suppliers';
import invoiceRoutes from './routes/invoices';
import paymentRoutes from './routes/payments';
import bankRoutes from './routes/banks';
import stockRoutes from './routes/stock';
import reportRoutes from './routes/reports';
import dashboardRoutes from './routes/dashboard';
import syncRoutes from './routes/sync';
import gstRoutes from './routes/gst';
import settingsRoutes from './routes/settings.routes';
import mobileRoutes from './routes/mobile';
import feedbackRoutes from './routes/feedback';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

// Middleware
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // server-to-server / local tools
      if (CORS_ORIGINS.length === 0) return cb(new Error('CORS blocked: origin is not allowlisted'));
      return cb(null, CORS_ORIGINS.includes(origin));
    },
    credentials: true,
  })
);
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 600),
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/mobile', mobileRoutes);

// Protected routes
app.use('/api/users', authenticate, userRoutes);
app.use('/api/company', authenticate, companyRoutes);
app.use('/api/products', authenticate, productRoutes);
app.use('/api/categories', authenticate, categoryRoutes);
app.use('/api/customers', authenticate, customerRoutes);
app.use('/api/suppliers', authenticate, supplierRoutes);
app.use('/api/invoices', authenticate, invoiceRoutes);
app.use('/api/payments', authenticate, paymentRoutes);
app.use('/api/banks', authenticate, bankRoutes);
app.use('/api/stock', authenticate, stockRoutes);
app.use('/api/reports', authenticate, reportRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/sync', authenticate, syncRoutes);
app.use('/api/gst', authenticate, gstRoutes);
app.use('/api/feedback', authenticate, feedbackRoutes);
app.use('/api', settingsRoutes);

// Error handler
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// WebSocket server for real-time sync
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      // Handle sync messages
      console.log('Received sync message:', data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready at ws://localhost:${PORT}/ws`);
});

export default app;