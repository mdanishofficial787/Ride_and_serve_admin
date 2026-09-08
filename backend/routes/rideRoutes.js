import express from 'express';
import { getPendingRides } from '../controllers/requestController.js';
import { createAssignment } from '../controllers/assignmentController.js';

const router = express.Router();

// GET /api/ride/pending - Fetch incoming unassigned customer ride requests
router.get('/pending', getPendingRides);

// POST /api/ride/assign - Assign selected driver to a ride
router.post('/assign', createAssignment);

export default router;
