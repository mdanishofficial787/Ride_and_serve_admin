import express from 'express';
import {
  getAllTerms,
  createTerm,
  updateTerm,
  publishTerm,
  getSettings,
  updateSettings,
  getLogs
} from '../controllers/termsController.js';

const router = express.Router();

router.route('/')
  .get(getAllTerms)
  .post(createTerm);

router.route('/:id')
  .put(updateTerm);

router.route('/:id/publish')
  .put(publishTerm);

router.route('/settings/all')
  .get(getSettings)
  .put(updateSettings);

router.route('/logs/all')
  .get(getLogs);

export default router;
