import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import driverRoutes from './routes/driverRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { sendSuccess } from './middleware/responseHandler.js';
import { DriverDB } from './models/dbAdapter.js';
import { seedDatabase } from './seed/seedData.js';
import adminAuthRoutes from './routes/adminAuthRoutes.js';
import adminDriverRoutes from './routes/adminDriverRoutes.js';
import adminVehicleRoutes from './routes/adminVehicleRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logger (Development)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
  console.log(`[${timestamp}] [API] ${req.method} ${req.originalUrl}`);
  next();
});

// Root & Healthcheck
app.get('/', (req, res) => {
  sendSuccess(res, {
    service: 'R&R Dispatcher Admin API',
    status: 'online',
    version: '1.0.0',
    port: PORT,
    endpoints: {
      drivers: '/api/drivers',
      driverStats: '/api/drivers/stats',
      availableDrivers: '/api/drivers/available',
      requests: '/api/requests',
      pendingRides: '/api/requests/pending',
      requestStats: '/api/requests/stats',
      assignments: '/api/assignments'
    }
  }, 'R&R Dispatcher API is active and running');
});

app.get('/api/health', (req, res) => {
  sendSuccess(res, { uptime: process.uptime(), timestamp: new Date() }, 'API Health OK');
});

import rideRoutes from './routes/rideRoutes.js';

// API Routes
app.use('/api/drivers', driverRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/ride', rideRoutes);
app.use('/api/rides', rideRoutes);

import adminPasswordResetRoutes from './routes/adminPasswordResetRoutes.js';
import adminDriverRatingRoutes from './routes/adminDriverRatingRoutes.js';

// New Admin Panel Verification API Routes
app.use('/admin/auth', adminAuthRoutes);
app.use('/admin/driver', adminDriverRoutes);
app.use('/admin/vehicle', adminVehicleRoutes);
app.use('/admin/password-resets', adminPasswordResetRoutes);
app.use('/admin/ratings', adminDriverRatingRoutes);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

// Serverless database connector middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (e) {
    console.error('[DB] Serverless connection error:', e);
  }
  next();
});

// Start Server (Local vs Serverless)
const startServer = async () => {
  try {
    await connectDB();

    // Ensure Default Admin exists in database
    const AdminModel = (await import('./models/Admin.js')).default;
    const adminExists = await AdminModel.findOne({ Email: 'admin@example.com' });
    if (!adminExists) {
      await AdminModel.create({
        Name: 'Super Admin',
        Email: 'admin@example.com',
        Password: 'yourpassword',
        role: 'superadmin'
      });
      console.log('[Server] Default Admin created (admin@example.com / yourpassword)');
    }

    if (process.env.VERCEL !== '1' && !process.env.NOW_REGION) {
      const server = app.listen(PORT, () => {
        console.log('====================================================');
        console.log(`🚀 R&R Dispatcher Backend running on: http://localhost:${PORT}`);
        console.log(`📡 Driver APIs:      http://localhost:${PORT}/api/drivers`);
        console.log(`📡 Request APIs:     http://localhost:${PORT}/api/requests`);
        console.log(`📡 Assignment APIs:  http://localhost:${PORT}/api/assignments`);
        console.log('====================================================');
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`⚠️ [Server] Port ${PORT} is already in use by a background process. Please terminate old process or retry.`);
        } else {
          console.error('[Server] Listen error:', err);
        }
      });
    }
  } catch (err) {
    console.error('[Server] Fatal error starting server:', err.message);
  }
};

startServer();

export default app;
