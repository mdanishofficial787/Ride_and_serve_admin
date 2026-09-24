import mongoose from "mongoose";

const travelRequestSchema = new mongoose.Schema({
  requestId:           { type: String },
  passengerName:       { type: String, default: "" },
  passengerPhone:      { type: String, default: "" },
  passengerEmail:      { type: String, default: "" },
  cnic:                { type: String, default: "" },
  pickupLocation:      { type: String, default: "" },
  dropoffLocation:     { type: String, default: "" },
  travelDate:          { type: String, default: "" },
  travelTime:          { type: String, default: "" },
  returnDate:          { type: String, default: "" },
  returnTime:          { type: String, default: "" },
  vehicleType:         { type: String, default: "" },
  passengersCount:     { type: Number, default: 1 },
  fare:                { type: Number, default: 0 },
  fareFormatted:       { type: String, default: "" },
  status:              { type: String, default: "Pending Dispatch" },
  notes:               { type: String, default: "" },
  assignedDriverId:    { type: String, default: null },
  assignedDriverName:  { type: String, default: null },
  assignedDriverPhone: { type: String, default: null },
  dispatchedAt:        { type: Date, default: null },
  createdAt:           { type: Date, default: Date.now },
  updatedAt:           { type: Date, default: Date.now }
}, { strict: false });

export default mongoose.models.TravelRequest || mongoose.model("TravelRequest", travelRequestSchema, "travelrequests");
