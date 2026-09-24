import express from "express";
import {
  getAllTravelRequests,
  dispatchTravelRequest,
  updateTravelRequest
} from "../controllers/travelRequestController.js";

const router = express.Router();

// GET /api/travel-requests
router.get("/", getAllTravelRequests);

// PATCH /api/travel-requests/:id/dispatch
router.patch("/:id/dispatch", dispatchTravelRequest);

// PATCH /api/travel-requests/:id
router.patch("/:id", updateTravelRequest);
router.put("/:id", updateTravelRequest);

export default router;
