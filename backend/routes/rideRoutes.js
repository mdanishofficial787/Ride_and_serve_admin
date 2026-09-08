import express from 'express';
import { getPendingRides } from '../controllers/requestController.js';
import { createAssignment, getDriverAssignedRides } from '../controllers/assignmentController.js';

const router = express.Router();

// GET /api/ride/pending - Fetch incoming unassigned customer ride requests
router.get('/pending', getPendingRides);

// POST /api/ride/assign - Assign selected driver to a ride
router.post('/assign', createAssignment);

// GET /api/ride/assigned - Fetch all assigned rides (supports ?driverId=...)
router.get('/assigned', getDriverAssignedRides);

// GET /api/ride/driver/:driverId - Fetch assigned rides for a specific driver (Driver Panel / Flutter)
router.get('/driver/:driverId', getDriverAssignedRides);

export default router;

