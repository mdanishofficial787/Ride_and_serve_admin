import { AssignmentDB, RequestDB, RideDB, DriverDB, formatRideRecord } from '../models/dbAdapter.js';
import { sendSuccess, sendError } from '../middleware/responseHandler.js';

// @desc    Assign driver to ride request
// @route   POST /api/ride/assign, POST /api/assignments
export const createAssignment = async (req, res, next) => {
  try {
    const { requestId, rideId, driverId, remarks } = req.body;
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
      // Update Ride in `rides` collection
      const updatedRide = await RideDB.update(rideFilter, {
        status: 'ASSIGNED',
        driver: driver._id,
        driverId: driver._id,
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

      // Create Assignment record
      const newAssignment = await AssignmentDB.create({
        requestId: ride._id,
        driverId: driver._id,
        status: 'ASSIGNED',
        remarks: remarks || `Dispatched to ${assignedDriverName}`
      });

      // Update Driver Availability
      await DriverDB.update(drvFilter, { availability: 'On Trip' });

      return sendSuccess(res, {
        ...newAssignment,
        ride: formatRideRecord(updatedRide || ride),
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

    return sendSuccess(res, {
      ...newAssignment,
      request: formatRideRecord(request),
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

    const rawCustomerRides = await RideDB.find(rideQuery, { updatedAt: -1, createdAt: -1 }, 0, 100);
    const rawRequests = await RequestDB.find(rideQuery, { updatedAt: -1, createdAt: -1 }, 0, 100);

    const formattedRides = [...rawCustomerRides, ...rawRequests].map(formatRideRecord);

    return sendSuccess(res, {
      rides: formattedRides,
      total: formattedRides.length
    }, 'Driver assigned rides retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Get all rides with mapped structure & pending/assigned counts
// @desc    Get all rides with mapped structure & pending/assigned counts
// @route   GET /api/rides
export const getAllRides = async (req, res, next) => {
  try {
    const rawCustomerRides = await RideDB.find({}, { createdAt: -1, updatedAt: -1 }, 0, 100);
    const formattedCustomerRides = (rawCustomerRides || []).map(formatRideRecord);

    const idMap = new Map();
    formattedCustomerRides.forEach(r => {
      const key = r.requestId || r.id || String(r._id);
      if (!idMap.has(key)) {
        idMap.set(key, r);
      }
    });

    const rides = Array.from(idMap.values());

    let pendingCount = 0;
    let assignedCount = 0;

    rides.forEach(r => {
      if (r.status === 'ASSIGNED' || String(r.status).startsWith('Dispatched')) {
        assignedCount++;
      } else {
        pendingCount++;
      }
    });

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
    const { driverName, driverId, remarks } = req.body;

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

      await RideDB.update(rideFilter, {
        status: 'ASSIGNED',
        driver: driver?._id || driverId || null,
        driverId: driver?._id || driverId || null,
        assignedDriver: assignedDriverName,
        assignedDriverPhone: assignedPhone,
        assignedDriverDetails: {
          driverCode: assignedDriverCode,
          name: assignedDriverName,
          phone: assignedPhone,
          vehicle: assignedVehicle,
          rating: assignedRating
        }
      });

      if (driver) {
        await DriverDB.update({ _id: driver._id }, { availability: 'On Trip' });
      }

      return sendSuccess(res, {
        rideId: ride._id,
        requestId: ride.requestId || ride.id || ride._id,
        status: 'ASSIGNED',
        driverName: assignedDriverName,
        driverCode: assignedDriverCode
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
    await RequestDB.update(reqFilter, {
      status: 'ASSIGNED',
      driverId: driver?._id || driverId || null,
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

    if (driver) {
      await DriverDB.update({ _id: driver._id }, { availability: 'On Trip' });
    }

    return sendSuccess(res, {
      rideId: request._id,
      requestId: request.requestId,
      status: 'ASSIGNED',
      driverName: assignedDriverName,
      driverCode: assignedDriverCode
    }, `Driver ${assignedDriverName} successfully dispatched to ride ${request.requestId || id}`);
  } catch (err) {
    next(err);
  }
};
