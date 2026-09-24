import express from "express";
import {
  getAllScheduleRides,
  dispatchScheduleRide,
  updateScheduleRide
} from "../controllers/scheduleRideController.js";

const router = express.Router();

// GET /api/schedule-rides
router.get("/", getAllScheduleRides);

// PATCH /api/schedule-rides/:id/dispatch
router.patch("/:id/dispatch", dispatchScheduleRide);

// PATCH /api/schedule-rides/:id
router.patch("/:id", updateScheduleRide);
router.put("/:id", updateScheduleRide);

export default router;
