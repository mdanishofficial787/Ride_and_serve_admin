import mongoose from "mongoose";

const scheduleRideSchema = new mongoose.Schema({
  requestId:           { type: String },
  passengerName:       { type: String, default: "" },
  passengerPhone:      { type: String, default: "" },
  passengerEmail:      { type: String, default: "" },
  pickupLocation:      { type: String, default: "" },
  dropoffLocation:     { type: String, default: "" },
  startingFrom:        { type: String, default: "" },
  timeToReach:         { type: String, default: "" },
  timeToLeave:         { type: String, default: "" },
  rideType:            { type: String, default: "One Way" },
  vehicleType:         { type: String, default: "" },
  acPreference:        { type: String, default: "AC" },
  genderPreference:    { type: String, default: "" },
  fare:                { type: Number, default: 0 },
  fareFormatted:       { type: String, default: "" },
  status:              { type: String, default: "Pending Dispatch" },
  notes:               { type: String, default: "" },
  customSchedule:      { type: mongoose.Schema.Types.Mixed, default: null },
  assignedDriverId:    { type: String, default: null },
  assignedDriverName:  { type: String, default: null },
  assignedDriverPhone: { type: String, default: null },
  dispatchedAt:        { type: Date, default: null },
  createdAt:           { type: Date, default: Date.now },
  updatedAt:           { type: Date, default: Date.now }
}, { strict: false });

export default mongoose.models.ScheduleRide || mongoose.model("ScheduleRide", scheduleRideSchema, "scheduleriderequests");
