import mongoose from 'mongoose';
import { AssignmentDB, RequestDB, RideDB, DriverDB, formatRideRecord } from '../models/dbAdapter.js';
import { sendSuccess, sendError } from '../middleware/responseHandler.js';

// @desc    Assign driver to ride request
// @route   POST /api/ride/assign, POST /api/assignments
export const createAssignment = async (req, res, next) => {
  try {
    const { requestId, rideId, driverId, remarks, fare, fareFormatted } = req.body;
    const targetRideId = rideId || requestId;

    if (!targetRideId || !driverId) {
      return sendError(res, 'Both rideId (or requestId) and driverId are required', 400);
    }

    // 1. Find Driver
    const drvFilter = driverId.match(/^[0-9a-fA-F]{24}$/) ? { _id: driverId } : { driverId };
    const driver = await DriverDB.findOne(drvFilter);
    if (!driver) {
      return sendError(res, `Driver not found: ${driverId}`, 404);
    }

    const assignedDriverName = driver.Name || driver.name || 'Assigned Driver';
    const assignedDriverCode = driver.driverReferenceId || driver.driverId || `DRV-${String(driver._id).slice(-6).toUpperCase()}`;
    const assignedPhone = driver.PhoneNumber || driver.phone || '+92 300 0000000';
    const assignedVehicle = `${driver.vehicleDetails?.make || ''} ${driver.vehicleDetails?.model || ''}`.trim() || driver.vehicleType || 'Sedan';
    const assignedRating = driver.rating || 4.8;

    // 2. Check RideDB first (Customer App rides)
    const isMongoId = targetRideId.match(/^[0-9a-fA-F]{24}$/);
    const rideFilter = isMongoId ? { _id: targetRideId } : { rideId: targetRideId };
    let ride = await RideDB.findOne(rideFilter);

    if (ride) {
      const updateData = {
        status: 'ASSIGNED',
        driver: driver._id,
        driverId: driver._id,
        assignedDriver: assignedDriverName,
        assignedDriverPhone: assignedPhone,
        assignedDriverCode: assignedDriverCode,
        assignedDriverDetails: {
          driverCode: assignedDriverCode,
          name: assignedDriverName,
          phone: assignedPhone,
          vehicle: assignedVehicle,
          rating: assignedRating
        },
        $push: {
          timeline: {
            action: 'DISPATCHED',
            performedBy: 'Dispatcher',
            details: `Ride assigned to ${assignedDriverName} (${assignedDriverCode})`
          }
        }
      };

      if (fare !== undefined && fare !== null) {
        const numFare = Number(fare);
        if (!isNaN(numFare)) {
          updateData.fare = numFare;
          updateData.fareAmount = numFare;
          updateData.price = numFare;
          updateData.rawFare = numFare;
          updateData.fareFormatted = fareFormatted || `Rs. ${numFare.toLocaleString()}`;
        }
      }

      // Update Ride in `rides` collection
      const updatedRide = await RideDB.update(rideFilter, updateData);

      // Create Assignment record
      const newAssignment = await AssignmentDB.create({
        requestId: ride._id,
        driverId: driver._id,
        status: 'ASSIGNED',
        remarks: remarks || `Dispatched to ${assignedDriverName}`
      });

      // Update Driver Availability
      await DriverDB.update(drvFilter, { availability: 'On Trip' });

      // Socket.IO notification ONLY to that specific driver's app & admin room
      const io = req.app.get('io');
      const formattedRide = formatRideRecord(updatedRide || ride);
      if (io) {
        const payload = {
          rideId: ride._id,
          requestId: ride.requestId || ride.rideId || targetRideId,
          driverId: driver._id,
          driverCode: assignedDriverCode,
          driverName: assignedDriverName,
          driverPhone: assignedPhone,
          status: 'ASSIGNED',
          ride: formattedRide
        };
        // Forward ONLY to that specific driver's app room
        io.to(`driver-${driver._id}`).emit('new-assignment', payload);
        io.to(`driver-${driver._id}`).emit('ride-assigned', payload);
        io.to(`driver-${driver._id}`).emit('ride-dispatched', payload);
        if (driver.driverId) {
          io.to(`driver-${driver.driverId}`).emit('new-assignment', payload);
          io.to(`driver-${driver.driverId}`).emit('ride-assigned', payload);
          io.to(`driver-${driver.driverId}`).emit('ride-dispatched', payload);
        }
        if (assignedDriverCode) {
          io.to(`driver-${assignedDriverCode}`).emit('new-assignment', payload);
          io.to(`driver-${assignedDriverCode}`).emit('ride-assigned', payload);
          io.to(`driver-${assignedDriverCode}`).emit('ride-dispatched', payload);
        }
        // GLOBAL EMITS
        io.emit('new-request', payload);
        io.emit('new-assignment', payload);
        io.emit('ride-assigned', payload);
        io.emit('ride-dispatched', payload);

        // Notify admin portal dashboard
        io.to('admin-room').emit('ride-assigned', payload);
        io.to('admin-room').emit('ride-dispatched', payload);
        io.to('admin-room').emit('ride-updated', payload);
      }

      return sendSuccess(res, {
        ...newAssignment,
        ride: formattedRide,
        driver
      }, `Ride ${ride.rideId || targetRideId} successfully assigned to ${assignedDriverName}`, 201);
    }

    // 3. Fallback: Check RequestDB (Admin Manual requests)
    const reqFilter = isMongoId ? { _id: targetRideId } : { requestId: targetRideId };
    const request = await RequestDB.findOne(reqFilter);
    if (!request) {
      return sendError(res, `Ride request not found: ${targetRideId}`, 404);
    }

    // Create Assignment
    const newAssignment = await AssignmentDB.create({
      requestId: request._id,
      driverId: driver._id,
      status: 'ASSIGNED',
      remarks: remarks || `Dispatched to ${assignedDriverName}`
    });

    // Update Request
    await RequestDB.update(reqFilter, {
      status: 'ASSIGNED',
      driverId: driver._id,
      assignedDriver: assignedDriverName,
      assignedDriverPhone: assignedPhone,
      assignedDriverCode: assignedDriverCode,
      assignedDriverDetails: {
        driverCode: assignedDriverCode,
        name: assignedDriverName,
        phone: assignedPhone,
        vehicle: assignedVehicle,
        rating: assignedRating
      },
      $push: {
        timeline: {
          action: 'DISPATCHED',
          performedBy: 'Dispatcher',
          details: `Ride assigned to ${assignedDriverName} (${assignedDriverCode})`
        }
      }
    });

    // Update Driver Availability
    await DriverDB.update(drvFilter, {
      availability: 'On Trip'
    });

    const formattedReq = formatRideRecord(request);
    const ioFallback = req.app.get('io');
    if (ioFallback) {
      const payload = {
        rideId: request._id,
        requestId: request.requestId,
        driverId: driver._id,
        driverCode: assignedDriverCode,
        driverName: assignedDriverName,
        driverPhone: assignedPhone,
        passengerName: formattedReq.passengerName,
        passengerPhone: formattedReq.passengerPhone,
        customerPhone: formattedReq.customerPhone,
        phone: formattedReq.phone,
        userPhone: formattedReq.userPhone,
        pickupLocation: formattedReq.pickupLocation,
        dropoffLocation: formattedReq.dropoffLocation,
        fare: formattedReq.fare,
        fareAmount: formattedReq.fareAmount,
        fareFormatted: formattedReq.fareFormatted,
        status: 'ASSIGNED',
        ride: formattedReq
      };
      ioFallback.emit('new-request', payload);
      ioFallback.emit('new-assignment', payload);
      ioFallback.emit('ride-assigned', payload);
      ioFallback.emit('ride-dispatched', payload);
      ioFallback.to(`driver-${driver._id}`).emit('new-assignment', payload);
      if (driver.driverId) ioFallback.to(`driver-${driver.driverId}`).emit('new-assignment', payload);
      if (assignedDriverCode) ioFallback.to(`driver-${assignedDriverCode}`).emit('new-assignment', payload);
    }

    return sendSuccess(res, {
      ...newAssignment,
      request: formattedReq,
      driver
    }, `Ride ${request.requestId} successfully assigned to ${assignedDriverName}`, 201);
  } catch (err) {
    next(err);
  }
};

// @desc    Get all assignments
// @route   GET /api/assignments
export const getAssignments = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) {
      query.status = status.toUpperCase();
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const total = await AssignmentDB.count(query);
    const assignments = await AssignmentDB.find(query, '-createdAt', skip, limitNum);

    return sendSuccess(res, {
      assignments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      }
    }, 'Assignments retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Get assigned rides for a specific driver or all drivers (for Driver Panel / Flutter Mobile)
// @route   GET /api/ride/assigned, GET /api/ride/driver/:driverId, GET /api/drivers/:id/rides
export const getDriverAssignedRides = async (req, res, next) => {
  try {
    const { driverId, id } = req.params;
    const targetDriverId = driverId || id || req.query.driverId;

    let driverObj = null;
    if (targetDriverId) {
      const isMongoId = targetDriverId.match(/^[0-9a-fA-F]{24}$/);
      const drvFilter = isMongoId ? { _id: targetDriverId } : { driverId: targetDriverId };
      driverObj = await DriverDB.findOne(drvFilter);
    }

    // Query assigned rides in `rides` collection
    let rideQuery = {
      $or: [
        { status: 'ASSIGNED' },
        { status: 'assigned' },
        { driver: { $ne: null } },
        { driverId: { $ne: null } }
      ]
    };

    if (driverObj) {
      rideQuery = {
        $or: [
          { driver: driverObj._id },
          { driverId: driverObj._id },
          { 'assignedDriverDetails.driverCode': driverObj.driverId || driverObj.driverReferenceId },
          { 'assignedDriverDetails.name': driverObj.Name || driverObj.name }
        ]
      };
    }

    
      // Additional direct queries for new modules (Schedule, Travel, Hire Driver)
      let extraRides = [];
      const client = mongoose.connection?.client;
      if (client && driverObj) {
        const extraCollections = ['schedulerides', 'traveltourismrequests', 'driverhirerequests'];
        const drvIdStr = String(driverObj._id);
        const drvCodeStr = driverObj.driverId || driverObj.driverReferenceId;
        const drvNameStr = driverObj.Name || driverObj.name;
        
        for (const col of extraCollections) {
          const docs = await client.db('ride_and_serve').collection(col).find({
            $or: [
              { status: 'ASSIGNED' },
              { status: 'assigned' }
            ]
          }).toArray().catch(() => []);
          
          docs.forEach(d => {
            const assignedId = String(d.assignedDriverId || d.driverId || '');
            const assignedName = String(d.assignedDriverName || d.assignedDriver || '');
            const assignedCode = String(d.assignedDriverCode || d.assignedDriverDetails?.driverCode || '');
            
            if (
               (assignedId === drvIdStr || assignedId === String(targetDriverId)) ||
               (assignedName === drvNameStr && drvNameStr) ||
               (assignedCode === drvCodeStr && drvCodeStr)
            ) {
               extraRides.push(d);
            }
          });
        }
      }

      const rawCustomerRides = await RideDB.find(rideQuery, { updatedAt: -1, createdAt: -1 }, 0, 100);
    const rawRequests = await RequestDB.find(rideQuery, { updatedAt: -1, createdAt: -1 }, 0, 100);

    const formattedRides = [...rawCustomerRides, ...rawRequests, ...extraRides].map(formatRideRecord);

    let finalRides = formattedRides;
    if (targetDriverId) {
      const tid = String(targetDriverId).toLowerCase().trim();
      finalRides = formattedRides.filter(r => {
        const dId = String(r.driverId || r.driver || '').toLowerCase();
        const dCode = String(r.assignedDriverDetails?.driverCode || '').toLowerCase();
        const dName = String(r.assignedDriverDetails?.name || '').toLowerCase();
        return dId === tid || dCode === tid || (driverObj && (
          dId === String(driverObj._id).toLowerCase() || 
          dCode === String(driverObj.driverId || driverObj.driverReferenceId || '').toLowerCase() || 
          dName === String(driverObj.Name || driverObj.name || '').toLowerCase()
        ));
      });
    }

    return sendSuccess(res, {
      rides: finalRides,
      data: finalRides,
      total: finalRides.length
    }, 'Driver assigned rides retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Get all rides with mapped structure & pending/assigned counts
// @route   GET /api/rides
export const getAllRides = async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const rawCustomerRides = await RideDB.find({}, { _id: -1 }, 0, 200);
    const rawPoolRequests = await RequestDB.find({}, { _id: -1 }, 0, 200);
    const allRaw = [...(rawCustomerRides || []), ...(rawPoolRequests || [])];
    const formattedCustomerRides = allRaw.map(formatRideRecord);

    const idMap = new Map();
    formattedCustomerRides.forEach(r => {
      const key = r.requestId || r.id || String(r._id);
      if (!idMap.has(key)) {
        idMap.set(key, r);
      }
    });

    const { status } = req.query;
    let rides = Array.from(idMap.values());

    let pendingCount = 0;
    let assignedCount = 0;

    rides.forEach(r => {
      if (r.status === 'ASSIGNED' || String(r.status).startsWith('Dispatched')) {
        assignedCount++;
      } else {
        pendingCount++;
      }
    });

    if (status && (status.toLowerCase() === 'pending' || status.toLowerCase() === 'pending dispatch')) {
      rides = rides.filter(r => {
        const s = String(r.status || '').trim().toUpperCase();
        const rawS = String(r.rawStatus || '').trim().toUpperCase();
        return s === 'PENDING DISPATCH' || s === 'PENDING' || s === 'VISIBLE' || s === 'DRAFT' ||
               rawS === 'PENDING DISPATCH' || rawS === 'PENDING' || rawS === 'VISIBLE' ||
               (!r.driverId && !r.driver && s !== 'ASSIGNED' && !s.startsWith('DISPATCH') && s !== 'COMPLETED' && s !== 'CANCELLED');
      });
    }

    return res.status(200).json({
      success: true,
      pendingCount,
      assignedCount,
      totalCount: rides.length,
      data: rides,
      rides
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Dispatch driver to a ride request (PATCH /api/rides/:id/dispatch)
// @route   PATCH /api/rides/:id/dispatch
export const dispatchDriverToRide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { driverName, driverId, remarks, fare, fareAmount, price, rawFare, fareFormatted } = req.body;

    if (!id) {
      return sendError(res, 'Ride ID is required', 400);
    }

    let driver = null;
    if (driverId) {
      const drvMongo = driverId.match(/^[0-9a-fA-F]{24}$/);
      driver = await DriverDB.findOne(drvMongo ? { _id: driverId } : { driverId });
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

    const assignedDriverName = driver?.Name || driverName || driver?.name || driver?.personalInfo?.name || 'Assigned Driver';
    const assignedDriverCode = driver?.driverReferenceId || driver?.driverId || driver?.id || `DRV-${String(driver?._id || id).slice(-6).toUpperCase()}`;
    const assignedPhone = driver?.PhoneNumber || driver?.phone || driver?.personalInfo?.phone || '+92 300 0000000';
    const assignedVehicle = driver ? `${driver.vehicleDetails?.make || driver.vehicleInfo?.make || ''} ${driver.vehicleDetails?.model || driver.vehicleInfo?.model || ''}`.trim() || driver.vehicleType || 'Sedan' : 'Vehicle';
    const assignedRating = driver?.rating || driver?.performance?.rating || 4.8;

    const isMongoId = id.match(/^[0-9a-fA-F]{24}$/);
    const rideFilter = isMongoId ? { _id: id } : { requestId: id };

    // Check RideDB first (Customer app rides in ride_and_serve.riderequests)
    let ride = await RideDB.findOne(rideFilter);
    if (ride) {
      await AssignmentDB.create({
        requestId: ride._id,
        driverId: driver?._id || driverId || null,
        status: 'ASSIGNED',
        remarks: remarks || `Dispatched to ${assignedDriverName}`
      });

      const updateData = {
        status: 'ASSIGNED',
        driver: driver?._id || driverId || null,
        driverId: driver?._id || driverId || null,
        assignedDriver: assignedDriverName,
        assignedDriverPhone: assignedPhone,
        assignedDriverCode: assignedDriverCode,
        assignedDriverDetails: {
          driverCode: assignedDriverCode,
          name: assignedDriverName,
          phone: assignedPhone,
          vehicle: assignedVehicle,
          rating: assignedRating
        }
      };

      const targetFare = fare !== undefined ? fare : (fareAmount !== undefined ? fareAmount : (price !== undefined ? price : rawFare));
      if (targetFare !== undefined && targetFare !== null) {
        const numFare = Number(targetFare);
        if (!isNaN(numFare)) {
          updateData.fare = numFare;
          updateData.fareAmount = numFare;
          updateData.price = numFare;
          updateData.rawFare = numFare;
          updateData.fareFormatted = fareFormatted || `Rs. ${numFare.toLocaleString()}`;
        }
      }

      const updatedRide = await RideDB.update(rideFilter, updateData);

      if (driver) {
        await DriverDB.update({ _id: driver._id }, { availability: 'On Trip' });
      }

      const formatted = formatRideRecord(updatedRide || ride);
      const io = req.app.get('io');
      if (io) {
        const payload = {
          rideId: ride._id,
          requestId: ride.requestId || ride.id || id,
          driverId: driver?._id || driverId,
          driverCode: assignedDriverCode,
          driverName: assignedDriverName,
          driverPhone: assignedPhone,
          passengerName: formatted.passengerName,
          passengerPhone: formatted.passengerPhone,
          customerPhone: formatted.customerPhone,
          phone: formatted.phone,
          userPhone: formatted.userPhone,
          pickupLocation: formatted.pickupLocation,
          dropoffLocation: formatted.dropoffLocation,
          fare: formatted.fare,
          fareAmount: formatted.fareAmount,
          price: formatted.price || formatted.fare,
          rawFare: formatted.fare,
          fareFormatted: formatted.fareFormatted,
          status: 'ASSIGNED',
          tripType: formatted.tripType,
          serviceType: formatted.serviceType,
          vehicleType: formatted.vehicleType,
          genderPreference: formatted.genderPreference,
          acPreference: formatted.acPreference,
          returnPickupLocation: formatted.returnPickupLocation,
          returnDropoffLocation: formatted.returnDropoffLocation,
          returnDateTime: formatted.returnDateTime,
          additionalNotes: formatted.additionalNotes || formatted.notes,
          notes: formatted.notes || formatted.additionalNotes,
          ride: formatted
        };
        // Forward ONLY to that specific driver's app room
        if (driver?._id) {
          io.to(`driver-${driver._id}`).emit('new-assignment', payload);
          io.to(`driver-${driver._id}`).emit('ride-assigned', payload);
          io.to(`driver-${driver._id}`).emit('ride-dispatched', payload);
        }
        if (driverId && (!driver?._id || String(driverId) !== String(driver._id))) {
          io.to(`driver-${driverId}`).emit('new-assignment', payload);
          io.to(`driver-${driverId}`).emit('ride-assigned', payload);
          io.to(`driver-${driverId}`).emit('ride-dispatched', payload);
        }
        if (assignedDriverCode) {
          io.to(`driver-${assignedDriverCode}`).emit('new-assignment', payload);
          io.to(`driver-${assignedDriverCode}`).emit('ride-assigned', payload);
          io.to(`driver-${assignedDriverCode}`).emit('ride-dispatched', payload);
        }

        // GLOBAL EMITS to ensure Driver App receives the request regardless of rooms
        io.emit('new-request', payload);
        io.emit('new-assignment', payload);
        io.emit('ride-assigned', payload);
        io.emit('ride-dispatched', payload);

        // Notify Admin Portal dashboard
        io.to('admin-room').emit('ride-dispatched', payload);
        io.to('admin-room').emit('ride-updated', payload);
        // Customer is NOT notified yet until driver accepts the ride
      }

      return sendSuccess(res, {
        rideId: ride._id,
        requestId: ride.requestId || ride.id || ride._id,
        status: 'ASSIGNED',
        driverName: assignedDriverName,
        driverCode: assignedDriverCode,
        fare: formatted.fare,
        fareFormatted: formatted.fareFormatted,
        ride: formatted
      }, `Driver ${assignedDriverName} successfully dispatched to ride`);
    }

    // Check RequestDB
    const reqFilter = isMongoId ? { _id: id } : { requestId: id };
    const request = await RequestDB.findOne(reqFilter);

    if (!request) {
      return sendError(res, `Ride request not found: ${id}`, 404);
    }

    // Create Assignment Record
    await AssignmentDB.create({
      requestId: request._id,
      driverId: driver?._id || driverId || null,
      status: 'ASSIGNED',
      remarks: remarks || `Dispatched to ${assignedDriverName}`
    });

    // Update Request
    const reqUpdateData = {
      status: 'ASSIGNED',
      driverId: driver?._id || driverId || null,
      assignedDriver: assignedDriverName,
      assignedDriverPhone: assignedPhone,
      assignedDriverCode: assignedDriverCode,
      assignedDriverDetails: {
        driverCode: assignedDriverCode,
        name: assignedDriverName,
        phone: assignedPhone,
        vehicle: assignedVehicle,
        rating: assignedRating
      },
      $push: {
        timeline: {
          action: 'DISPATCHED',
          performedBy: 'Dispatcher',
          details: `Ride assigned to ${assignedDriverName} (${assignedDriverCode})`
        }
      }
    };

    const targetReqFare = fare !== undefined ? fare : (fareAmount !== undefined ? fareAmount : (price !== undefined ? price : rawFare));
    if (targetReqFare !== undefined && targetReqFare !== null) {
      const numFare = Number(targetReqFare);
      if (!isNaN(numFare)) {
        reqUpdateData.fare = numFare;
        reqUpdateData.fareAmount = numFare;
        reqUpdateData.price = numFare;
        reqUpdateData.rawFare = numFare;
        reqUpdateData.fareFormatted = fareFormatted || `Rs. ${numFare.toLocaleString()}`;
      }
    }

    const updatedRequest = await RequestDB.update(reqFilter, reqUpdateData);

    if (driver) {
      await DriverDB.update({ _id: driver._id }, { availability: 'On Trip' });
    }

    const formattedReq = formatRideRecord(updatedRequest || request);
    const ioReq = req.app.get('io');
    if (ioReq) {
      const payload = {
        rideId: request._id,
        requestId: request.requestId || id,
        driverId: driver?._id || driverId,
        driverCode: assignedDriverCode,
        driverName: assignedDriverName,
        driverPhone: assignedPhone,
        fare: formattedReq.fare,
        fareAmount: formattedReq.fareAmount,
        price: formattedReq.price || formattedReq.fare,
        rawFare: formattedReq.fare,
        fareFormatted: formattedReq.fareFormatted,
        status: 'ASSIGNED',
        ride: formattedReq
      };
      // Forward ONLY to that specific driver's app room
      if (driver?._id) {
        ioReq.to(`driver-${driver._id}`).emit('new-assignment', payload);
        ioReq.to(`driver-${driver._id}`).emit('ride-assigned', payload);
        ioReq.to(`driver-${driver._id}`).emit('ride-dispatched', payload);
      }
      if (driverId && (!driver?._id || String(driverId) !== String(driver._id))) {
        ioReq.to(`driver-${driverId}`).emit('new-assignment', payload);
        ioReq.to(`driver-${driverId}`).emit('ride-assigned', payload);
        ioReq.to(`driver-${driverId}`).emit('ride-dispatched', payload);
      }
      if (assignedDriverCode) {
        ioReq.to(`driver-${assignedDriverCode}`).emit('new-assignment', payload);
        ioReq.to(`driver-${assignedDriverCode}`).emit('ride-assigned', payload);
        ioReq.to(`driver-${assignedDriverCode}`).emit('ride-dispatched', payload);
      }

      // GLOBAL EMITS
      ioReq.emit('new-request', payload);
      ioReq.emit('new-assignment', payload);
      ioReq.emit('ride-assigned', payload);
      ioReq.emit('ride-dispatched', payload);

      // Notify Admin Portal dashboard
      ioReq.to('admin-room').emit('ride-dispatched', payload);
      ioReq.to('admin-room').emit('ride-updated', payload);
      // Customer is NOT notified yet
    }

    return sendSuccess(res, {
      rideId: request._id,
      requestId: request.requestId,
      status: 'ASSIGNED',
      driverName: assignedDriverName,
      driverCode: assignedDriverCode,
      fare: formattedReq.fare,
      fareFormatted: formattedReq.fareFormatted,
      ride: formattedReq
    }, `Driver ${assignedDriverName} successfully dispatched to ride ${request.requestId || id}`);
  } catch (err) {
    next(err);
  }
};

// @desc    Update ride details (e.g. fare, notes, status)
// @route   PATCH /api/rides/:id, PUT /api/rides/:id
export const updateRide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fare, fareAmount, price, rawFare, fareFormatted, status, notes } = req.body;

    if (!id) {
      return sendError(res, 'Ride ID is required', 400);
    }

    const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isMongoId ? { _id: id } : { requestId: id };

    const updateFields = {};
    const targetFare = fare !== undefined ? fare : (fareAmount !== undefined ? fareAmount : (price !== undefined ? price : rawFare));
    if (targetFare !== undefined && targetFare !== null) {
      const numFare = Number(targetFare);
      const validNum = !isNaN(numFare) ? numFare : targetFare;
      const validFmt = fareFormatted || (!isNaN(numFare) ? `Rs. ${numFare.toLocaleString()}` : String(targetFare));
      updateFields.fare = validNum;
      updateFields.fareAmount = validNum;
      updateFields.price = validNum;
      updateFields.rawFare = validNum;
      updateFields.fareFormatted = validFmt;
    }
    if (status !== undefined) updateFields.status = status;
    if (notes !== undefined) updateFields.notes = notes;

    // 1. Check & Update RideDB (Customer App collection)
    let updated = await RideDB.update(filter, updateFields);

    // 2. Check & Update RequestDB (Admin requests collection)
    if (!updated) {
      updated = await RequestDB.update(filter, updateFields);
    }

    // 3. Fallback: try alternative ID field
    if (!updated && !isMongoId) {
      updated = await RideDB.update({ _id: id }, updateFields);
      if (!updated) updated = await RequestDB.update({ _id: id }, updateFields);
    }

    // Also sync to RequestDB if requestId matches
    if (updated?.requestId) {
      await RequestDB.update({ requestId: updated.requestId }, updateFields).catch(() => {});
    }

    const formatted = formatRideRecord(updated || { _id: id, ...updateFields });

    const io = req.app.get('io');
    if (io) {
      io.emit('ride-update', { id, ...updateFields, ride: formatted });
      io.emit('ride-updated', { id, ...updateFields, ride: formatted });
    }

    return sendSuccess(res, {
      id,
      ...updateFields,
      ride: formatted
    }, 'Ride updated successfully');
  } catch (err) {
    next(err);
  }
};
