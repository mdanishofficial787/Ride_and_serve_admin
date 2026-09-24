import express from 'express';
import {
  getAllReplacementRequests,
  assignReplacementDriver,
  rejectReplacementRequest,
  createReplacementRequest
} from '../controllers/replacementController.js';

const router = express.Router();

// GET /api/replacement-requests - Fetch all replacement requests
router.get('/', getAllReplacementRequests);

// POST /api/replacement-requests - Create a replacement request
router.post('/', createReplacementRequest);

// PATCH /api/replacement-requests/:id/assign - Assign replacement driver
router.patch('/:id/assign', assignReplacementDriver);

// PATCH /api/replacement-requests/:id/reject - Reject replacement request
router.patch('/:id/reject', rejectReplacementRequest);

export default router;
