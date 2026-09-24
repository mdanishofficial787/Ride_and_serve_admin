import express from 'express';
import { getPendingRides } from '../controllers/requestController.js';
import { 
  createAssignment, 
  getDriverAssignedRides,
  getAllRides,
  dispatchDriverToRide,
  updateRide
} from '../controllers/assignmentController.js';

const router = express.Router();

// GET /api/rides - Fetch all rides (pending & assigned with counts)
router.get('/', getAllRides);

// GET /api/rides/pending or /api/ride/pending - Fetch incoming unassigned customer ride requests
router.get('/pending', getPendingRides);

// POST /api/ride/assign or /api/rides/assign - Assign selected driver to a ride
router.post('/assign', createAssignment);

// PATCH /api/rides/:id/dispatch - Dispatch Driver to Ride (e.g. { driverName: "Ali Khan" })
router.patch('/:id/dispatch', dispatchDriverToRide);

// PATCH /api/rides/:id or PUT /api/rides/:id - Update ride details/fare
router.patch('/:id', updateRide);
router.put('/:id', updateRide);

// GET /api/ride/assigned or /api/rides/assigned - Fetch all assigned rides (supports ?driverId=...)
router.get('/assigned', getDriverAssignedRides);

// GET /api/ride/driver/:driverId - Fetch assigned rides for a specific driver (Driver Panel / Flutter)
router.get('/driver/:driverId', getDriverAssignedRides);

export default router;


