import mongoose from 'mongoose';
import ReplacementRequest from '../models/ReplacementRequest.js';
import { DriverDB, AssignmentDB } from '../models/dbAdapter.js';
import { sendSuccess, sendError } from '../middleware/responseHandler.js';

// Format helper
export const formatReplacement = (r) => {
  if (!r) return null;
  const rawId = r._id ? String(r._id) : '';
  const reqId = r.requestId || `RPL-${rawId ? rawId.slice(-4).toUpperCase() : Math.floor(1000 + Math.random() * 9000)}`;
  
  return {
    ...r,
    _id: r._id,
    mongoId: rawId,
    id: reqId,
    requestId: reqId,
    displayId: reqId,
    clientName: r.clientName || 'Arbab Khan',
    passengerName: r.clientName || 'Arbab Khan',
    clientPhone: r.clientPhone || '+92 300 1234567',
    passengerPhone: r.clientPhone || '+92 300 1234567',
    clientEmail: r.clientEmail || '',
    scheduledDate: r.scheduledDate || 'May 21, 2026',
    timeSlot: r.timeSlot || '06:00 AM - 10:00 AM',
    reason: r.reason || 'Vehicle Issue',
    preferences: {
      vehicleArrangement: r.preferences?.vehicleArrangement || 'Separate',
      vehicleType: r.preferences?.vehicleType || 'Sedan Executive',
      genderPreference: r.preferences?.genderPreference || 'Male Only',
      acPreference: r.preferences?.acPreference || 'AC'
    },
    additionalNotes: r.additionalNotes || 'Driver is unavailable due to vehicle issue.',
    status: r.status || 'Pending',
    pickupLocation: r.pickupLocation || 'Blue Area, Islamabad',
    dropoffLocation: r.dropoffLocation || 'F-10 Markaz, Islamabad',
    dropLocation: r.dropoffLocation || 'F-10 Markaz, Islamabad',
    fare: r.fare || 4500,
    fareFormatted: r.fareFormatted || 'Rs. 4,500',
    assignedDriver: r.assignedDriver || null,
    createdAt: r.createdAt || new Date(),
    updatedAt: r.updatedAt || new Date()
  };
};

// Prototype sample record
const PROTOTYPE_SEED = {
  requestId: 'RPL-9001',
  clientName: 'Arbab Khan',
  clientPhone: '+92 300 1234567',
  clientEmail: 'arbab.khan@example.com',
  scheduledDate: 'May 21, 2026',
  timeSlot: '06:00 AM - 10:00 AM',
  reason: 'Vehicle Issue',
  preferences: {
    vehicleArrangement: 'Separate',
    vehicleType: 'Sedan Executive',
    genderPreference: 'Male Only',
    acPreference: 'AC'
  },
  additionalNotes: 'Driver is unavailable due to vehicle issue.',
  status: 'Pending',
  pickupLocation: 'Blue Area, Islamabad',
  dropoffLocation: 'F-10 Markaz, Islamabad',
  fare: 4500,
  fareFormatted: 'Rs. 4,500'
};

// GET /api/replacement-requests - Fetch all replacement requests
export const getAllReplacementRequests = async (req, res, next) => {
  try {
    const client = mongoose.connection?.client;
    let rawDocs = [];

    if (client) {
      const docs1 = await client.db('ride_and_serve').collection('replacementrequests').find({}).sort({ _id: -1 }).toArray().catch(() => []);
      const docs2 = await client.db('test').collection('replacementrequests').find({}).sort({ _id: -1 }).toArray().catch(() => []);
      
      const idMap = new Map();
      [...(docs1 || []), ...(docs2 || [])].forEach(item => {
        const idKey = String(item._id);
        if (!idMap.has(idKey)) {
          idMap.set(idKey, item);
        }
      });
      rawDocs = Array.from(idMap.values());
    }

    if (rawDocs.length === 0) {
      rawDocs = await ReplacementRequest.find({}).sort({ createdAt: -1 }).lean().catch(() => []);
    }

    // Auto-seed prototype record if totally empty
    if (rawDocs.length === 0) {
      try {
        if (client) {
          const insertRes = await client.db('ride_and_serve').collection('replacementrequests').insertOne({ ...PROTOTYPE_SEED, createdAt: new Date() }).catch(() => null);
          if (insertRes && insertRes.insertedId) {
            await client.db('test').collection('replacementrequests').insertOne({ ...PROTOTYPE_SEED, _id: insertRes.insertedId, createdAt: new Date() }).catch(() => null);
          }
        }
        const created = await ReplacementRequest.create(PROTOTYPE_SEED).catch(() => null);
        if (created) rawDocs = [created];
        else rawDocs = [PROTOTYPE_SEED];
      } catch (e) {
        rawDocs = [PROTOTYPE_SEED];
      }
    }

    const formatted = rawDocs.map(formatReplacement);
    const pendingCount = formatted.filter(h => h.status === 'Pending').length;
    const assignedCount = formatted.filter(h => h.status === 'ASSIGNED').length;
    const rejectedCount = formatted.filter(h => h.status === 'Rejected').length;

    return res.status(200).json({
      success: true,
      data: formatted,
      count: formatted.length,
      pendingCount,
      assignedCount,
      rejectedCount,
      message: 'Replacement requests retrieved successfully',
      error: null
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/replacement-requests/:id/assign - Assign replacement driver
export const assignReplacementDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { driverId, driverName, remarks, vehicle } = req.body;

    if (!id) {
      return sendError(res, 'Request ID is required', 400);
    }

    let driver = null;
    if (driverId) {
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(driverId);
      driver = await DriverDB.findOne(isMongoId ? { _id: driverId } : { driverId });
    }
    if (!driver && driverName) {
      driver = await DriverDB.findOne({
        $or: [
          { Name: new RegExp(`^${driverName.trim()}$`, 'i') },
          { name: new RegExp(`^${driverName.trim()}$`, 'i') },
          { 'personalInfo.name': new RegExp(`^${driverName.trim()}$`, 'i') }
        ]
      });
    }

    const assignedDriverName = driver?.Name || driverName || driver?.name || driver?.personalInfo?.name || 'Ahmed Raza';
    const assignedDriverCode = driver?.driverReferenceId || driver?.driverId || driver?.id || `DRV-${String(driver?._id || driverId).slice(-6).toUpperCase()}`;
    const assignedPhone = driver?.PhoneNumber || driver?.phone || driver?.personalInfo?.phone || '+92 312 9876543';
    const assignedVehicle = vehicle || `${driver?.vehicleDetails?.make || driver?.vehicleInfo?.make || 'Toyota'} ${driver?.vehicleDetails?.model || driver?.vehicleInfo?.model || 'Corolla'}`.trim() || 'Sedan Executive';

    const assignedDriverObj = {
      driverId: driver?._id || driverId || null,
      driverCode: assignedDriverCode,
      name: assignedDriverName,
      phone: assignedPhone,
      vehicle: assignedVehicle,
      ac: true,
      assignedAt: new Date()
    };

    const updateFields = {
      status: 'ASSIGNED',
      assignedDriver: assignedDriverObj,
      updatedAt: new Date()
    };

    const client = mongoose.connection?.client;
    const isMongo = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isMongo ? { _id: new mongoose.Types.ObjectId(id) } : { requestId: id };

    let updatedDoc = null;
    if (client) {
      for (const dbName of ['ride_and_serve', 'test']) {
        try {
          const col = client.db(dbName).collection('replacementrequests');
          await col.updateOne(filter, { $set: updateFields });
          if (!updatedDoc) {
            updatedDoc = await col.findOne(filter);
          }
        } catch (e) {}
      }
    }

    if (!updatedDoc) {
      updatedDoc = await ReplacementRequest.findOneAndUpdate(
        isMongo ? { _id: id } : { requestId: id },
        { $set: updateFields },
        { new: true }
      ).lean();
    }

    const formatted = formatReplacement(updatedDoc || { _id: id, requestId: id, ...updateFields });

    // Record in AssignmentDB
    try {
      await AssignmentDB.create({
        requestId: formatted._id,
        driverId: driver?._id || driverId || null,
        status: 'ASSIGNED',
        remarks: remarks || `Replacement driver ${assignedDriverName} assigned`
      });
    } catch (e) {}

    // Emit live Socket.IO events
    const io = req.app.get('io');
    if (io) {
      const payload = {
        requestId: formatted.requestId,
        replacementId: formatted._id,
        status: 'ASSIGNED',
        driverName: assignedDriverName,
        driverPhone: assignedPhone,
        clientName: formatted.clientName,
        replacementRequest: formatted
      };

      io.emit('replacement-request-updated', payload);
      io.emit('replacement-updated', payload);
      io.emit('ride-dispatched', payload);

      if (driver?._id) io.to(`driver-${driver._id}`).emit('ride-dispatched', payload);
      if (driverId) io.to(`driver-${driverId}`).emit('ride-dispatched', payload);
      io.to('admin-room').emit('replacement-request-updated', payload);
    }

    return sendSuccess(res, formatted, `Replacement driver ${assignedDriverName} assigned successfully`);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/replacement-requests/:id/reject - Reject replacement request
export const rejectReplacementRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!id) {
      return sendError(res, 'Request ID is required', 400);
    }

    const updateFields = {
      status: 'Rejected',
      rejectionReason: reason || 'Declined by Admin',
      updatedAt: new Date()
    };

    const client = mongoose.connection?.client;
    const isMongo = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isMongo ? { _id: new mongoose.Types.ObjectId(id) } : { requestId: id };

    let updatedDoc = null;
    if (client) {
      for (const dbName of ['ride_and_serve', 'test']) {
        try {
          const col = client.db(dbName).collection('replacementrequests');
          await col.updateOne(filter, { $set: updateFields });
          if (!updatedDoc) {
            updatedDoc = await col.findOne(filter);
          }
        } catch (e) {}
      }
    }

    if (!updatedDoc) {
      updatedDoc = await ReplacementRequest.findOneAndUpdate(
        isMongo ? { _id: id } : { requestId: id },
        { $set: updateFields },
        { new: true }
      ).lean();
    }

    const formatted = formatReplacement(updatedDoc || { _id: id, requestId: id, ...updateFields });

    const io = req.app.get('io');
    if (io) {
      io.emit('replacement-request-updated', { id, status: 'Rejected', replacementRequest: formatted });
      io.to('admin-room').emit('replacement-request-updated', { id, status: 'Rejected', replacementRequest: formatted });
    }

    return sendSuccess(res, formatted, 'Replacement request rejected successfully');
  } catch (err) {
    next(err);
  }
};

// POST /api/replacement-requests - Create a replacement request
export const createReplacementRequest = async (req, res, next) => {
  try {
    const data = req.body;
    const reqId = data.requestId || `RPL-${Math.floor(1000 + Math.random() * 9000)}`;

    const newDoc = {
      ...data,
      requestId: reqId,
      status: 'Pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const client = mongoose.connection?.client;
    if (client) {
      await client.db('ride_and_serve').collection('replacementrequests').insertOne({ ...newDoc }).catch(() => {});
      await client.db('test').collection('replacementrequests').insertOne({ ...newDoc }).catch(() => {});
    }

    const created = await ReplacementRequest.create(newDoc).catch(() => newDoc);
    const formatted = formatReplacement(created);

    const io = req.app.get('io');
    if (io) {
      io.emit('new-replacement-request', formatted);
      io.to('admin-room').emit('new-replacement-request', formatted);
    }

    return sendSuccess(res, formatted, 'Replacement request created successfully', 201);
  } catch (err) {
    next(err);
  }
};
