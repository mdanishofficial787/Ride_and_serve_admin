import express from 'express';
import {
  getAllDriverHires,
  dispatchDriverHire,
  updateDriverHire,
  createDriverHire
} from '../controllers/driverHireController.js';

const router = express.Router();

// GET /api/driver-hire - Fetch all driver hire requests
router.get('/', getAllDriverHires);

// POST /api/driver-hire - Create a driver hire request
router.post('/', createDriverHire);

// PATCH /api/driver-hire/:id/dispatch - Dispatch driver to hire request
router.patch('/:id/dispatch', dispatchDriverHire);

// PATCH /api/driver-hire/:id - Update hire request details/fare
router.patch('/:id', updateDriverHire);
router.put('/:id', updateDriverHire);

export default router;
