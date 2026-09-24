import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { connectDB } from './config/db.js';
import driverRoutes from './routes/driverRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { sendSuccess } from './middleware/responseHandler.js';
import { DriverDB } from './models/dbAdapter.js';
import adminAuthRoutes from './routes/adminAuthRoutes.js';
import adminDriverRoutes from './routes/adminDriverRoutes.js';
import adminVehicleRoutes from './routes/adminVehicleRoutes.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.IO setup with CORS for all localhost origins
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173', '*'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: false
  },
  transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });

  // Admin joins a room to receive ride updates
  socket.on('join-admin', () => {
    socket.join('admin-room');
    console.log(`[Socket.IO] Admin joined room: ${socket.id}`);
  });

  // Driver joins room to receive dispatched rides in real-time
  socket.on('join-driver', (driverId) => {
    if (driverId) {
      socket.join(`driver-${driverId}`);
      console.log(`[Socket.IO] Driver ${driverId} joined room: driver-${driverId}`);
    }
  });

  // Customer joins room to receive ride updates & driver unavailable alerts in real-time
  socket.on('join-customer', (customerId) => {
    socket.join('customer-room');
    if (customerId) {
      socket.join(`customer-${customerId}`);
      console.log(`[Socket.IO] Customer ${customerId} joined room: customer-${customerId}`);
    } else {
      console.log(`[Socket.IO] Customer joined customer-room: ${socket.id}`);
    }
  });

  // Join specific ride room for real-time ride tracking
  socket.on('join-ride', (rideId) => {
    if (rideId) {
      socket.join(`ride-${rideId}`);
      console.log(`[Socket.IO] Client ${socket.id} joined ride room: ride-${rideId}`);
    }
  });

  // Real-time replacement request trigger from Customer App
  socket.on('customer-request-replacement', async (data) => {
    console.log('[Socket.IO] 🔔 Customer requested replacement driver:', data);
    io.emit('new-replacement-request', data);
    io.to('admin-room').emit('new-replacement-request', data);
    io.to('admin-room').emit('replacement-requested', data);
  });
});

// Make io accessible globally for controllers
app.set('io', io);

// CORS Middleware - Allow all origins and all headers
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
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
      pendingRides: '/api/ride/pending',
      requestStats: '/api/requests/stats',
      allRides: '/api/rides',
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

import driverHireRoutes from './routes/driverHireRoutes.js';
app.use('/api/driver-hire', driverHireRoutes);
app.use('/api/driver-hires', driverHireRoutes);

import replacementRoutes from './routes/replacementRoutes.js';
app.use('/api/replacement-requests', replacementRoutes);

import customerRoutes from './routes/customerRoutes.js';
app.use('/api/customer', customerRoutes);

// Schedule Rides & Travel Tourism Routes
import scheduleRideRoutes from './routes/scheduleRideRoutes.js';
app.use('/api/schedule-rides', scheduleRideRoutes);

import travelRequestRoutes from './routes/travelRequestRoutes.js';
app.use('/api/travel-requests', travelRequestRoutes);

import adminPasswordResetRoutes from './routes/adminPasswordResetRoutes.js';
import adminDriverRatingRoutes from './routes/adminDriverRatingRoutes.js';
import issueRoutes from './routes/issueRoutes.js';

// Admin Panel Verification API Routes
app.use('/admin/auth', adminAuthRoutes);
app.use('/admin/driver', adminDriverRoutes);
app.use('/admin/vehicle', adminVehicleRoutes);
app.use('/admin/password-resets', adminPasswordResetRoutes);
app.use('/admin/ratings', adminDriverRatingRoutes);
app.use('/admin/issues', issueRoutes);
app.use('/api/issues', issueRoutes);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
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
      httpServer.listen(PORT, () => {
        console.log('====================================================');
        console.log(`🚀 R&R Dispatcher Backend running on: http://localhost:${PORT}`);
        console.log(`🔌 Socket.IO enabled at:              http://localhost:${PORT}`);
        console.log(`📡 All Rides API:     http://localhost:${PORT}/api/rides`);
        console.log(`📡 Pending Rides API: http://localhost:${PORT}/api/ride/pending`);
        console.log(`📡 Driver APIs:       http://localhost:${PORT}/api/drivers`);
        console.log(`📡 Assign Ride:       POST http://localhost:${PORT}/api/ride/assign`);
        console.log('====================================================');
      });

      // Background Real-Time Watcher for Incoming Customer Rides (1-second polling across databases)
      const knownRideIds = new Set();
      let isWatcherInitialized = false;

      setInterval(async () => {
        try {
          const mongoose = (await import('mongoose')).default;
          const client = mongoose.connection?.client;
          if (client && mongoose.connection.readyState === 1) {
            const ridesRas = await client.db('ride_and_serve').collection('riderequests').find({}).sort({ _id: -1 }).limit(25).toArray().catch(() => []);
            const ridesTest = await client.db('test').collection('riderequests').find({}).sort({ _id: -1 }).limit(25).toArray().catch(() => []);
            const latestRides = [...(ridesRas || []), ...(ridesTest || [])];

            if (latestRides && latestRides.length > 0) {
              if (!isWatcherInitialized) {
                latestRides.forEach(r => knownRideIds.add(String(r._id)));
                isWatcherInitialized = true;
              } else {
                for (const ride of latestRides) {
                  const idStr = String(ride._id);
                  if (!knownRideIds.has(idStr)) {
                    knownRideIds.add(idStr);
                    console.log(`[Realtime Watcher] 🔔 New Customer Ride Detected: ${ride.requestId || idStr} (${ride.passengerName || 'Customer'})`);
                    io.emit('new-ride', ride);
                    io.emit('ride-created', ride);
                    io.to('admin-room').emit('new-ride', ride);
                  }
                }
              }
            }
          }
        } catch (e) {}
      }, 1000);

      // Background Real-Time Watcher for Incoming Driver Reported Issues
      const knownIssueIds = new Set();
      let isIssueWatcherInitialized = false;

      setInterval(async () => {
        try {
          const mongoose = (await import('mongoose')).default;
          const client = mongoose.connection?.client;
          if (client && mongoose.connection.readyState === 1) {
            const issuesTest = await client.db('test').collection('issuereports').find({}).sort({ createdAt: -1 }).limit(20).toArray().catch(() => []);
            const issuesRas = await client.db('ride_and_serve').collection('driverissues').find({}).sort({ createdAt: -1 }).limit(20).toArray().catch(() => []);
            const latestIssues = [...(issuesTest || []), ...(issuesRas || [])];

            if (latestIssues && latestIssues.length > 0) {
              if (!isIssueWatcherInitialized) {
                latestIssues.forEach(i => knownIssueIds.add(String(i._id)));
                isIssueWatcherInitialized = true;
              } else {
                for (const iss of latestIssues) {
                  const idStr = String(iss._id);
                  if (!knownIssueIds.has(idStr)) {
                    knownIssueIds.add(idStr);
                    console.log(`[Realtime Watcher] 🔔 New Driver Issue Detected: ${iss.reason || 'Road Issue'} from ${iss.driverName || 'Driver'}`);
                    
                    const normalizedIssue = {
                      _id: iss._id,
                      mongoId: idStr,
                      issueId: iss.issueId || `ISS-${idStr.slice(-4).toUpperCase()}`,
                      driverId: iss.driver || iss.driverId || null,
                      driverName: iss.driverName || 'Driver',
                      driverPhone: iss.driverPhone || '',
                      vehicle: iss.vehicle || 'Sedan Executive',
                      reason: iss.reason || 'Road Issue',
                      description: iss.details || iss.description || '',
                      details: iss.details || iss.description || '',
                      location: iss.location || (iss.fromTime && iss.toTime ? `${iss.fromTime} - ${iss.toTime}` : 'Current Location'),
                      fromTime: iss.fromTime || '',
                      toTime: iss.toTime || '',
                      fromDate: iss.fromDate || null,
                      toDate: iss.toDate || null,
                      status: iss.status || 'Pending',
                      severity: iss.severity || (iss.reason === 'Emergency' || iss.reason === 'Vehicle Issue' ? 'High' : 'Medium'),
                      createdAt: iss.createdAt || new Date()
                    };

                    io.emit('new_issue_report', normalizedIssue);
                    io.emit('new-issue-report', normalizedIssue);
                    io.emit('driver-issue-created', normalizedIssue);
                    io.to('admin-room').emit('new_issue_report', normalizedIssue);
                  }
                }
              }
            }
          }
        } catch (e) {}
      }, 1500);

      httpServer.on('error', (err) => {
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
