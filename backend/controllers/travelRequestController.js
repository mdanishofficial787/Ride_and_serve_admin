import mongoose from "mongoose";
import TravelRequest from "../models/TravelRequest.js";
import { sendSuccess, sendError } from "../middleware/responseHandler.js";

const COLLECTIONS = ["traveltourismrequests", "travelrequests", "travel_requests", "travelrequestss"];
const DBS = ["ride_and_serve", "test"];

const formatTravelRequest = (doc) => {
  if (!doc) return null;
  const d = doc._doc || doc;
  const idStr = String(d._id || "");
  const fareNum = Number(d.fare || d.fareAmount || 0);
  return {
    _id: idStr,
    id: idStr,
    mongoId: idStr,
    requestId: d.requestId || `TT-${idStr.slice(-4).toUpperCase()}`,
    passengerName: d.passengerName || d.customerName || d.name || "Passenger",
    passengerPhone: d.passengerPhone || d.customerPhone || d.phone || "",
    passengerEmail: d.passengerEmail || d.customerEmail || d.email || "",
    cnic: d.cnic || "",
    pickupLocation: d.pickupLocation || d.pickup || d.from || d.origin || "",
    dropoffLocation: d.dropoffLocation || d.dropoff || d.to || d.destination || "",
    travelDate: d.travelDate || d.date || d.startDate || "",
    travelTime: d.travelTime || d.time || "",
    returnDate: d.returnDate || "",
    returnTime: d.returnTime || "",
    vehicleType: d.vehicleType || d.vehiclePreference || "",
    passengersCount: Number(d.passengersCount || d.passengerCount || d.seats || 1),
    fare: fareNum,
    fareFormatted: d.fareFormatted || (fareNum > 0 ? `Rs. ${fareNum.toLocaleString()}` : "Not Set"),
    status: d.status || "Pending Dispatch",
    notes: d.notes || d.additionalNotes || "",
    assignedDriverId: d.assignedDriverId || d.driverId || null,
    assignedDriverName: d.assignedDriverName || d.driverName || null,
    assignedDriverPhone: d.assignedDriverPhone || null,
    dispatchedAt: d.dispatchedAt || null,
    createdAt: d.createdAt || new Date()
  };
};

// GET /api/travel-requests
export const getAllTravelRequests = async (req, res, next) => {
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

    try {
      const mongooseDocs = await TravelRequest.find({}).sort({ createdAt: -1 }).limit(100).lean();
      for (const doc of mongooseDocs) {
        const id = String(doc._id);
        if (!seenIds.has(id)) { seenIds.add(id); allDocs.push(doc); }
      }
    } catch (e) {}

    const formatted = allDocs.map(formatTravelRequest).filter(Boolean);
    return sendSuccess(res, formatted, `${formatted.length} travel request(s) found`);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/travel-requests/:id/dispatch
export const dispatchTravelRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { driverId, driverName, fare } = req.body;

    if (!id) return sendError(res, "Travel Request ID is required", 400);

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
      updatedDoc = await TravelRequest.findOneAndUpdate(
        isMongo ? { _id: id } : { requestId: id },
        { $set: updateFields },
        { new: true, upsert: false }
      ).lean();
    }

    const formatted = formatTravelRequest(updatedDoc || { _id: id, requestId: id, ...updateFields });

    const io = req.app.get("io");
    if (io) {
      io.emit("travel-request-dispatched", formatted);
      io.emit("travel-request-updated", formatted);
      io.to("admin-room").emit("travel-request-dispatched", formatted);
      if (driverId) io.to(`driver-${driverId}`).emit("ride-dispatched", formatted);
    }

    return sendSuccess(res, formatted, `Driver ${driverName || ""} dispatched to travel request`);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/travel-requests/:id
export const updateTravelRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fare, fareFormatted, status, notes } = req.body;

    if (!id) return sendError(res, "Travel Request ID is required", 400);

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
      updatedDoc = await TravelRequest.findOneAndUpdate(
        isMongo ? { _id: id } : { requestId: id },
        { $set: updateFields },
        { new: true }
      ).lean();
    }

    const formatted = formatTravelRequest(updatedDoc || { _id: id, ...updateFields });

    const io = req.app.get("io");
    if (io) {
      io.emit("travel-request-updated", { id, ...updateFields, travelRequest: formatted });
      io.to("admin-room").emit("travel-request-updated", { id, ...updateFields, travelRequest: formatted });
    }

    return sendSuccess(res, formatted, "Travel request updated successfully");
  } catch (err) {
    next(err);
  }
};
