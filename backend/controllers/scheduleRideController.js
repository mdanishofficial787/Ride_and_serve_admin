import mongoose from "mongoose";
import ScheduleRide from "../models/ScheduleRide.js";
import { sendSuccess, sendError } from "../middleware/responseHandler.js";

// Collections to check in each DB (cover both naming conventions from customer app)
const COLLECTIONS = ["schedulerides", "scheduleriderequests", "schedulerequests", "schedule_rides"];
const DBS = ["ride_and_serve", "test"];

const formatScheduleRide = (doc) => {
  if (!doc) return null;
  const d = doc._doc || doc;
  const idStr = String(d._id || "");
  const fareNum = Number(d.fare || d.fareAmount || 0);
  return {
    _id: idStr,
    id: idStr,
    mongoId: idStr,
    requestId: d.requestId || `SCH-${idStr.slice(-4).toUpperCase()}`,
    passengerName: d.passengerName || d.customerName || d.name || "Passenger",
    passengerPhone: d.passengerPhone || d.customerPhone || d.phone || "",
    passengerEmail: d.passengerEmail || d.customerEmail || d.email || "",
    pickupLocation: d.pickupLocation || d.pickup || d.from || "",
    dropoffLocation: d.dropoffLocation || d.dropoff || d.to || "",
    startingFrom: d.startingFrom || d.startDate || "",
    timeToReach: d.timeToReach || d.time || "",
    timeToLeave: d.timeToLeave || "",
    rideType: d.rideType || "One Way",
    vehicleType: d.vehicleType || d.vehiclePreference || "",
    acPreference: d.acPreference || "AC",
    genderPreference: d.genderPreference || "",
    fare: fareNum,
    fareFormatted: d.fareFormatted || (fareNum > 0 ? `Rs. ${fareNum.toLocaleString()}` : "Not Set"),
    status: d.status || "Pending Dispatch",
    notes: d.notes || d.additionalNotes || "",
    customSchedule: d.customSchedule || null,
    assignedDriverId: d.assignedDriverId || d.driverId || null,
    assignedDriverName: d.assignedDriverName || d.driverName || null,
    assignedDriverPhone: d.assignedDriverPhone || null,
    dispatchedAt: d.dispatchedAt || null,
    createdAt: d.createdAt || new Date()
  };
};

// GET /api/schedule-rides
export const getAllScheduleRides = async (req, res, next) => {
  try {
    const client = mongoose.connection?.client;
    const allDocs = [];
    const seenIds = new Set();

    if (client) {
      for (const dbName of DBS) {
        for (const colName of COLLECTIONS) {
          try {
            const docs = await client.db(dbName).collection(colName)
              .find({}).sort({ createdAt: -1 }).limit(100).toArray();
            for (const doc of docs) {
              const id = String(doc._id);
              if (!seenIds.has(id)) { seenIds.add(id); allDocs.push(doc); }
            }
          } catch (e) {}
        }
      }
    }

    // Also query via Mongoose model as fallback
    try {
      const mongooseDocs = await ScheduleRide.find({}).sort({ createdAt: -1 }).limit(100).lean();
      for (const doc of mongooseDocs) {
        const id = String(doc._id);
        if (!seenIds.has(id)) { seenIds.add(id); allDocs.push(doc); }
      }
    } catch (e) {}

    const formatted = allDocs.map(formatScheduleRide).filter(Boolean);
    return sendSuccess(res, formatted, `${formatted.length} schedule ride(s) found`);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/schedule-rides/:id/dispatch
export const dispatchScheduleRide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { driverId, driverName, fare } = req.body;

    if (!id) return sendError(res, "Schedule Ride ID is required", 400);

    const updateFields = {
      status: "ASSIGNED",
      assignedDriverId: driverId || null,
      assignedDriverName: driverName || "Assigned Driver",
      dispatchedAt: new Date(),
      updatedAt: new Date()
    };

    if (fare !== undefined && fare !== null) {
      const numFare = Number(fare);
      if (!isNaN(numFare) && numFare > 0) {
        updateFields.fare = numFare;
        updateFields.fareFormatted = `Rs. ${numFare.toLocaleString()}`;
      }
    }

    const isMongo = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isMongo ? { _id: new mongoose.Types.ObjectId(id) } : { requestId: id };

    const client = mongoose.connection?.client;
    let updatedDoc = null;

    if (client) {
      for (const dbName of DBS) {
        for (const colName of COLLECTIONS) {
          try {
            const col = client.db(dbName).collection(colName);
            const result = await col.updateOne(filter, { $set: updateFields });
            if (result.matchedCount > 0 && !updatedDoc) {
              updatedDoc = await col.findOne(filter);
            }
          } catch (e) {}
        }
      }
    }

    if (!updatedDoc) {
      updatedDoc = await ScheduleRide.findOneAndUpdate(
        isMongo ? { _id: id } : { requestId: id },
        { $set: updateFields },
        { new: true, upsert: false }
      ).lean();
    }

    const formatted = formatScheduleRide(updatedDoc || { _id: id, requestId: id, ...updateFields });

    const io = req.app.get("io");
    if (io) {
      io.emit("schedule-ride-dispatched", formatted);
      io.emit("schedule-ride-updated", formatted);
      io.to("admin-room").emit("schedule-ride-dispatched", formatted);
      if (driverId) io.to(`driver-${driverId}`).emit("ride-dispatched", formatted);
    }

    return sendSuccess(res, formatted, `Driver ${driverName || ""} dispatched to schedule ride`);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/schedule-rides/:id
export const updateScheduleRide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fare, fareFormatted, status, notes } = req.body;

    if (!id) return sendError(res, "Schedule Ride ID is required", 400);

    const updateFields = { updatedAt: new Date() };
    if (fare !== undefined && fare !== null) {
      const numFare = Number(fare);
      if (!isNaN(numFare)) {
        updateFields.fare = numFare;
        updateFields.fareFormatted = fareFormatted || `Rs. ${numFare.toLocaleString()}`;
      }
    }
    if (status !== undefined) updateFields.status = status;
    if (notes !== undefined) updateFields.notes = notes;

    const isMongo = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isMongo ? { _id: new mongoose.Types.ObjectId(id) } : { requestId: id };

    const client = mongoose.connection?.client;
    let updatedDoc = null;

    if (client) {
      for (const dbName of DBS) {
        for (const colName of COLLECTIONS) {
          try {
            const col = client.db(dbName).collection(colName);
            const result = await col.updateOne(filter, { $set: updateFields });
            if (result.matchedCount > 0 && !updatedDoc) {
              updatedDoc = await col.findOne(filter);
            }
          } catch (e) {}
        }
      }
    }

    if (!updatedDoc) {
      updatedDoc = await ScheduleRide.findOneAndUpdate(
        isMongo ? { _id: id } : { requestId: id },
        { $set: updateFields },
        { new: true }
      ).lean();
    }

    const formatted = formatScheduleRide(updatedDoc || { _id: id, ...updateFields });

    const io = req.app.get("io");
    if (io) {
      io.emit("schedule-ride-updated", { id, ...updateFields, scheduleRide: formatted });
      io.to("admin-room").emit("schedule-ride-updated", { id, ...updateFields, scheduleRide: formatted });
    }

    return sendSuccess(res, formatted, "Schedule ride updated successfully");
  } catch (err) {
    next(err);
  }
};
