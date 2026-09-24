import express from 'express';
import { protectAdmin } from '../middleware/adminAuth.js';
import {
  getIssues,
  createIssue,
  resolveIssue
} from '../controllers/issueController.js';

const router = express.Router();

// Allow optional protectAdmin or direct access
router.use(protectAdmin);

// GET /admin/issues - Fetch all driver reported issues
// POST /admin/issues - Create a new driver issue report
router.get('/', getIssues);
router.post('/', createIssue);

// PATCH /admin/issues/:id/resolve - Mark issue as resolved or updated
router.patch('/:id/resolve', resolveIssue);
router.patch('/:id', resolveIssue);

export default router;
