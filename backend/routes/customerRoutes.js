import express from 'express';
import {
  getCustomerNotifications,
  getCustomerRideStatus,
  requestReplacementFromCustomer
} from '../controllers/customerController.js';

const router = express.Router();

// GET /api/customer/notifications - Get driver unavailable notifications for customer
router.get('/notifications', getCustomerNotifications);

// GET /api/customer/ride-status/:rideId - Get ride status & driver unavailability notice
router.get('/ride-status/:rideId', getCustomerRideStatus);

// POST /api/customer/request-replacement - Customer clicks "[ Request Replacement ]" button
router.post('/request-replacement', requestReplacementFromCustomer);

export default router;
