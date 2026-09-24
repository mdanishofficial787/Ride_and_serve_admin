import mongoose from 'mongoose';
import DriverIssueModel from '../models/DriverIssue.js';
import CustomerNotification from '../models/CustomerNotification.js';
import ReplacementRequest from '../models/ReplacementRequest.js';
import { sendSuccess, sendError } from '../middleware/responseHandler.js';

// Helper to get raw MongoDB client
function getRawClient() {
  return mongoose.connection?.client || null;
}

// Helper to fetch and normalize issues across test.issuereports, test.driverissues, and ride_and_serve.driverissues
export async function getNormalizedIssues() {
  const client = getRawClient();
  const allRawDocs = [];

  // 1. Fetch drivers map for enriching driver phone, vehicle, code
  const driversMap = {};
  if (client) {
    for (const dbName of ['test', 'ride_and_serve']) {
      try {
        const drivers = await client.db(dbName).collection('drivers').find({}).toArray();
        drivers.forEach(d => {
          const key = String(d._id);
          if (!driversMap[key]) driversMap[key] = d;
          if (d.Name) {
            driversMap[d.Name.toLowerCase().trim()] = d;
          }
        });
      } catch (e) {}
    }

    // 2. Fetch from test.issuereports (where Driver App submits)
    try {
      const docs1 = await client.db('test').collection('issuereports').find({}).sort({ createdAt: -1 }).toArray();
      docs1.forEach(d => allRawDocs.push({ ...d, _sourceDb: 'test', _sourceCol: 'issuereports' }));
    } catch (e) {}

    // 3. Fetch from test.driverissues
    try {
      const docs2 = await client.db('test').collection('driverissues').find({}).sort({ createdAt: -1 }).toArray();
      docs2.forEach(d => allRawDocs.push({ ...d, _sourceDb: 'test', _sourceCol: 'driverissues' }));
    } catch (e) {}

    // 4. Fetch from ride_and_serve.driverissues
    try {
      const docs3 = await client.db('ride_and_serve').collection('driverissues').find({}).sort({ createdAt: -1 }).toArray();
      docs3.forEach(d => allRawDocs.push({ ...d, _sourceDb: 'ride_and_serve', _sourceCol: 'driverissues' }));
    } catch (e) {}

    // 5. Fetch from ride_and_serve.issuereports
    try {
      const docs4 = await client.db('ride_and_serve').collection('issuereports').find({}).sort({ createdAt: -1 }).toArray();
      docs4.forEach(d => allRawDocs.push({ ...d, _sourceDb: 'ride_and_serve', _sourceCol: 'issuereports' }));
    } catch (e) {}
  }

  // Fallback to Mongoose model if no raw docs found
  if (allRawDocs.length === 0) {
    try {
      const mDocs = await DriverIssueModel.find({}).sort({ createdAt: -1 }).lean();
      mDocs.forEach(d => allRawDocs.push(d));
    } catch (e) {}
  }

  // Map and deduplicate by _id or issueId
  const seenIds = new Set();
  const normalizedList = [];

  for (const doc of allRawDocs) {
    const idKey = String(doc._id || doc.issueId);
    if (seenIds.has(idKey)) continue;
    seenIds.add(idKey);

    const driverKey = doc.driver ? String(doc.driver) : (doc.driverId ? String(doc.driverId) : '');
    const nameKey = doc.driverName ? doc.driverName.toLowerCase().trim() : '';
    const driverDoc = driversMap[driverKey] || driversMap[nameKey] || null;

    const issueId = doc.issueId || `ISS-${String(doc._id || '').slice(-4).toUpperCase()}`;
    const phone = doc.driverPhone || (driverDoc ? (driverDoc.CountryCode ? `${driverDoc.CountryCode} ${driverDoc.PhoneNumber}` : driverDoc.PhoneNumber) : '');
    const code = doc.driverCode || driverDoc?.driverReferenceId || '';
    const desc = doc.details || doc.description || '';
    const vehicle = doc.vehicle || (driverDoc?.vehicle || 'Sedan Executive');
    const loc = doc.location || (doc.fromTime && doc.toTime ? `${doc.fromTime} - ${doc.toTime}` : 'Current Route / Shift');

    let severity = doc.severity;
    if (!severity) {
      const reasonLower = (doc.reason || '').toLowerCase();
      if (reasonLower.includes('emergency') || reasonLower.includes('puncture') || reasonLower.includes('vehicle') || reasonLower.includes('accident')) {
        severity = 'High';
      } else {
        severity = 'Medium';
      }
    }

    normalizedList.push({
      _id: doc._id,
      mongoId: String(doc._id),
      issueId,
      driverId: doc.driver || doc.driverId || null,
      driverName: doc.driverName || driverDoc?.Name || 'Unknown Driver',
      driverPhone: phone,
      driverCode: code,
      vehicle,
      reason: doc.reason || 'Road Issue',
      description: desc,
      details: desc,
      location: loc,
      fromTime: doc.fromTime || '',
      toTime: doc.toTime || '',
      fromDate: doc.fromDate || null,
      toDate: doc.toDate || null,
      rideId: doc.rideId || doc.requestId || '',
      requestId: doc.requestId || doc.rideId || '',
      status: doc.status || 'Pending',
      severity,
      remarks: doc.remarks || '',
      sourceCollection: doc._sourceCol || 'issuereports',
      sourceDb: doc._sourceDb || 'test',
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || doc.createdAt || new Date()
    });
  }

  // Sort newest first
  normalizedList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return normalizedList;
}

// @desc    Get all driver reported issues
// @route   GET /admin/issues, GET /api/issues
export const getIssues = async (req, res, next) => {
  try {
    const issues = await getNormalizedIssues();
    const pendingCount = issues.filter(i => (i.status || 'Pending') === 'Pending').length;

    return res.status(200).json({
      success: true,
      count: issues.length,
      pendingCount,
      issues,
      data: issues
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new driver issue report (called by Flutter Driver App or Admin)
// @route   POST /admin/issues, POST /api/issues
export const createIssue = async (req, res, next) => {
  try {
    const { 
      driverId, 
      driver,
      driverName, 
      driverPhone, 
      driverCode, 
      vehicle, 
      reason, 
      description, 
      details,
      location, 
      rideId, 
      requestId, 
      fromTime,
      toTime,
      fromDate,
      toDate,
      severity 
    } = req.body;

    if (!driverName || !reason) {
      return sendError(res, 'driverName and reason are required', 400);
    }

    const issueId = `ISS-${Math.floor(1000 + Math.random() * 9000)}`;
    const newIssue = {
      issueId,
      driver: driver || driverId || null,
      driverId: driverId || driver || null,
      driverName,
      driverPhone: driverPhone || '',
      driverCode: driverCode || '',
      vehicle: vehicle || 'Sedan Executive',
      reason,
      description: description || details || '',
      details: details || description || '',
      location: location || (fromTime ? `${fromTime} - ${toTime}` : 'Current Location'),
      fromTime: fromTime || '',
      toTime: toTime || '',
      fromDate: fromDate || new Date(),
      toDate: toDate || new Date(),
      rideId: rideId || requestId || '',
      requestId: requestId || rideId || '',
      status: 'Pending',
      severity: severity || 'High',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const client = getRawClient();
    if (client) {
      // Insert into test.issuereports so Flutter App and Admin both see it
      try {
        const r1 = await client.db('test').collection('issuereports').insertOne(newIssue);
        newIssue._id = r1.insertedId;
      } catch (e) {}
      // Also insert into ride_and_serve.driverissues
      try {
        await client.db('ride_and_serve').collection('driverissues').insertOne(newIssue);
      } catch (e) {}
    } else {
      const doc = await DriverIssueModel.create(newIssue);
      newIssue._id = doc._id;
    }

    // Broadcast Real-Time Socket.IO events
    const io = req.app.get('io');
    if (io) {
      io.emit('new_issue_report', newIssue);
      io.emit('new-issue-report', newIssue);
      io.to('admin-room').emit('new_issue_report', newIssue);
    }

    return res.status(201).json({
      success: true,
      message: 'Issue reported successfully',
      issue: newIssue,
      data: newIssue
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update / Resolve issue
// @route   PATCH /admin/issues/:id/resolve, PATCH /api/issues/:id/resolve
export const resolveIssue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      status = 'Resolved', 
      remarks, 
      replacementDriverId, 
      replacementDriverName,
      notifyCustomer = true,
      affectedDate,
      affectedTime,
      reportedReason,
      additionalDetails,
      details,
      canRequestReplacement = true,
      rideId,
      requestId
    } = req.body;

    const client = getRawClient();
    const query = (id && id.match(/^[0-9a-fA-F]{24}$/))
      ? { $or: [{ _id: new mongoose.Types.ObjectId(id) }, { issueId: id }] }
      : { issueId: id };

    // Fetch existing issue to get all associated details
    let existingIssue = null;
    if (client) {
      for (const dbName of ['test', 'ride_and_serve']) {
        for (const colName of ['issuereports', 'driverissues']) {
          try {
            existingIssue = await client.db(dbName).collection(colName).findOne(query);
            if (existingIssue) break;
          } catch (e) {}
        }
        if (existingIssue) break;
      }
    }
    if (!existingIssue) {
      existingIssue = await DriverIssueModel.findOne(query).lean().catch(() => null);
    }

    const targetRideId = rideId || requestId || existingIssue?.rideId || existingIssue?.requestId || 'REQ-8031';
    const reasonText = reportedReason || req.body.reason || existingIssue?.reason || 'Vehicle Issue';
    
    // Format Affected Date e.g. "May 21, 2026"
    let formattedDate = affectedDate;
    if (!formattedDate) {
      if (existingIssue?.fromDate) {
        try {
          formattedDate = new Date(existingIssue.fromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {
          formattedDate = 'May 21, 2026';
        }
      } else {
        formattedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    // Format Affected Time Slot e.g. "08:00 AM - 10:00 AM"
    let formattedTime = affectedTime;
    if (!formattedTime) {
      if (existingIssue?.fromTime && existingIssue?.toTime) {
        formattedTime = `${existingIssue.fromTime} - ${existingIssue.toTime}`;
      } else {
        formattedTime = '08:00 AM - 10:00 AM';
      }
    }

    const explanationDetails = additionalDetails || details || remarks || existingIssue?.details || existingIssue?.description || 'Driver is unavailable due to a sudden mechanical issue with the vehicle. We apologize for the inconvenience and are working to find a replacement driver immediately. The issue is severe enough to prevent the ride.';

    // Lookup linked ride to get the EXACT customer details
    let linkedRide = null;
    if (targetRideId) {
      const isMongo = /^[0-9a-fA-F]{24}$/.test(targetRideId);
      const rideFilter = isMongo ? { _id: new mongoose.Types.ObjectId(targetRideId) } : { $or: [{ rideId: targetRideId }, { requestId: targetRideId }] };
      if (client) {
        for (const dbName of ['ride_and_serve', 'test']) {
          try {
            linkedRide = await client.db(dbName).collection('rides').findOne(rideFilter);
            if (!linkedRide) {
              linkedRide = await client.db(dbName).collection('riderequests').findOne(rideFilter);
            }
            if (linkedRide) break;
          } catch (e) {}
        }
      }
    }

    const targetCustomerId = linkedRide?.userId || linkedRide?.customerId || linkedRide?.passengerId || existingIssue?.customerId || null;
    const targetPassengerName = linkedRide?.passengerName || linkedRide?.customerName || linkedRide?.name || existingIssue?.passengerName || existingIssue?.clientName || 'Customer';
    const targetPassengerPhone = linkedRide?.passengerPhone || linkedRide?.customerPhone || linkedRide?.phone || linkedRide?.userPhone || existingIssue?.passengerPhone || existingIssue?.clientPhone || '';

    const customerNotifPayload = {
      notificationId: `NOTIF-${Math.floor(1000 + Math.random() * 9000)}`,
      type: 'DRIVER_UNAVAILABLE',
      title: 'Driver Unavailable',
      subtitle: 'Your assigned driver is unavailable for this ride.',
      rideId: targetRideId,
      requestId: targetRideId,
      issueId: existingIssue?.issueId || id,
      customerId: targetCustomerId ? String(targetCustomerId) : null,
      userId: targetCustomerId ? String(targetCustomerId) : null,
      driverId: existingIssue?.driver || existingIssue?.driverId || null,
      driverName: existingIssue?.driverName || 'Ahmed Raza',
      driverPhone: existingIssue?.driverPhone || '+92 300 1234567',
      passengerName: targetPassengerName,
      passengerPhone: targetPassengerPhone,
      affectedDate: formattedDate,
      affectedTime: formattedTime,
      reportedReason: `Reported Reason: ${reasonText}`,
      reason: reasonText,
      additionalDetails: explanationDetails,
      details: explanationDetails,
      canRequestReplacement: Boolean(canRequestReplacement),
      replacementRequested: false,
      status: 'UNAVAILABLE',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updateDoc = {
      $set: {
        status,
        remarks: remarks || 'Resolved by Dispatcher',
        replacementDriverId: replacementDriverId || undefined,
        replacementDriverName: replacementDriverName || undefined,
        customerNotified: Boolean(notifyCustomer),
        customerNotifiedAt: new Date(),
        customerNotification: customerNotifPayload,
        resolvedAt: new Date(),
        updatedAt: new Date()
      }
    };

    let updated = null;
    if (client) {
      // Update across test.issuereports and ride_and_serve.driverissues
      for (const dbName of ['test', 'ride_and_serve']) {
        for (const colName of ['issuereports', 'driverissues']) {
          try {
            await client.db(dbName).collection(colName).updateOne(query, updateDoc);
            if (!updated) {
              updated = await client.db(dbName).collection(colName).findOne(query);
            }
          } catch (e) {}
        }
      }
    } else {
      updated = await DriverIssueModel.findOneAndUpdate(query, updateDoc, { new: true });
    }

    // Persist Customer Notification & Seed Replacement Request if customer notification requested
    if (notifyCustomer) {
      if (client) {
        for (const dbName of ['ride_and_serve', 'test']) {
          try {
            await client.db(dbName).collection('customernotifications').insertOne({ ...customerNotifPayload });
          } catch (e) {}

          // Also update ride status to DRIVER_UNAVAILABLE in rides/riderequests
          try {
            const isMongo = /^[0-9a-fA-F]{24}$/.test(targetRideId);
            const rideFilter = isMongo ? { _id: new mongoose.Types.ObjectId(targetRideId) } : { $or: [{ rideId: targetRideId }, { requestId: targetRideId }] };
            await client.db(dbName).collection('rides').updateOne(rideFilter, {
              $set: {
                status: 'DRIVER_UNAVAILABLE',
                driverUnavailableNotice: customerNotifPayload,
                updatedAt: new Date()
              }
            });
            await client.db(dbName).collection('riderequests').updateOne(rideFilter, {
              $set: {
                status: 'DRIVER_UNAVAILABLE',
                driverUnavailableNotice: customerNotifPayload,
                updatedAt: new Date()
              }
            });
          } catch (e) {}
        }
      }

      try {
        await CustomerNotification.create(customerNotifPayload);
      } catch (e) {}

      // Seed pending ReplacementRequest in replacementrequests collection
      const repReqDoc = {
        requestId: `RPL-${Math.floor(1000 + Math.random() * 9000)}`,
        rideId: targetRideId,
        clientName: customerNotifPayload.passengerName,
        clientPhone: customerNotifPayload.passengerPhone || '+92 300 1234567',
        scheduledDate: formattedDate,
        timeSlot: formattedTime,
        reason: reasonText,
        preferences: {
          vehicleArrangement: 'Separate',
          vehicleType: existingIssue?.vehicle || 'Sedan Executive',
          genderPreference: 'Male Only',
          acPreference: 'AC'
        },
        additionalNotes: explanationDetails,
        status: 'Pending',
        pickupLocation: existingIssue?.location || 'Blue Area, Islamabad',
        dropoffLocation: 'F-10 Markaz, Islamabad',
        fare: 4500,
        fareFormatted: 'Rs. 4,500',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (client) {
        for (const dbName of ['ride_and_serve', 'test']) {
          try {
            await client.db(dbName).collection('replacementrequests').insertOne(repReqDoc);
          } catch (e) {}
        }
      }
      try {
        await ReplacementRequest.create(repReqDoc);
      } catch (e) {}
    }

    // Broadcast Real-Time Socket.IO events to Customer, Driver & Admin
    const io = req.app.get('io');
    if (io) {
      // 1. Issue update for Admin
      io.emit('issue_updated', updated || existingIssue);
      io.emit('issue-updated', updated || existingIssue);
      io.to('admin-room').emit('issue_updated', updated || existingIssue);

      // 2. Customer Notification Events
      if (notifyCustomer) {
        console.log(`[Socket.IO] 📢 Emitting Driver Unavailable Notification to Customer for ride ${targetRideId}`);
        io.emit('driver-unavailable', customerNotifPayload);
        io.emit('customer-notification', customerNotifPayload);
        io.emit('ride-status-updated', {
          rideId: targetRideId,
          status: 'DRIVER_UNAVAILABLE',
          notification: customerNotifPayload
        });

        // Targeted Private Rooms for the SPECIFIC CUSTOMER
        if (customerNotifPayload.customerId) {
          io.to(`customer-${customerNotifPayload.customerId}`).emit('driver-unavailable', customerNotifPayload);
          io.to(`user-${customerNotifPayload.customerId}`).emit('driver-unavailable', customerNotifPayload);
          io.to(`customer-${customerNotifPayload.customerId}`).emit('customer-notification', customerNotifPayload);
        }

        if (customerNotifPayload.passengerPhone) {
          const cleanPhone = String(customerNotifPayload.passengerPhone).replace(/[^0-9]/g, '');
          const last7 = cleanPhone.slice(-7);
          io.to(`customer-${customerNotifPayload.passengerPhone}`).emit('driver-unavailable', customerNotifPayload);
          io.to(`customer-${cleanPhone}`).emit('driver-unavailable', customerNotifPayload);
          if (last7) io.to(`customer-${last7}`).emit('driver-unavailable', customerNotifPayload);
        }

        // Targeted Ride Room
        io.to(`ride-${targetRideId}`).emit('driver-unavailable', customerNotifPayload);
        io.to(`ride-${targetRideId}`).emit('customer-notification', customerNotifPayload);

        // General fallback
        io.to('customer-room').emit('driver-unavailable', customerNotifPayload);
        io.to('customer-room').emit('customer-notification', customerNotifPayload);
      }
    }

    return res.status(200).json({
      success: true,
      message: notifyCustomer ? 'Issue resolved and unavailability notification sent to customer' : 'Issue resolved successfully',
      issue: updated || existingIssue,
      customerNotification: notifyCustomer ? customerNotifPayload : null
    });
  } catch (err) {
    next(err);
  }
};
