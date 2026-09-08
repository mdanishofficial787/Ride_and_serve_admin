import { AssignmentDB, RequestDB, DriverDB } from '../models/dbAdapter.js';
import { sendSuccess, sendError } from '../middleware/responseHandler.js';

// @desc    Assign driver to ride request
// @route   POST /api/assignments
export const createAssignment = async (req, res, next) => {
  try {
    const { requestId, rideId, driverId, remarks } = req.body;
    const targetRideId = rideId || requestId;

    if (!targetRideId || !driverId) {
      return sendError(res, 'Both rideId (or requestId) and driverId are required', 400);
    }

    // Find Request
    const reqFilter = targetRideId.match(/^[0-9a-fA-F]{24}$/) ? { _id: targetRideId } : { requestId: targetRideId };
    const request = await RequestDB.findOne(reqFilter);
    if (!request) {
      return sendError(res, `Ride request not found: ${targetRideId}`, 404);
    }

    // Find Driver
    const drvFilter = driverId.match(/^[0-9a-fA-F]{24}$/) ? { _id: driverId } : { driverId };
    const driver = await DriverDB.findOne(drvFilter);
    if (!driver) {
      return sendError(res, `Driver not found: ${driverId}`, 404);
    }

    // Create Assignment
    const newAssignment = await AssignmentDB.create({
      requestId: request._id,
      driverId: driver._id,
      status: 'ASSIGNED',
      remarks: remarks || `Dispatched to ${driver.name}`
    });

    // Update Request
    await RequestDB.update(reqFilter, {
      status: 'ASSIGNED',
      driverId: driver._id,
      assignedDriverDetails: {
        driverCode: driver.driverId,
        name: driver.name,
        phone: driver.phone,
        vehicle: `${driver.vehicleDetails?.year || ''} ${driver.vehicleDetails?.make || ''} ${driver.vehicleDetails?.model || ''}`.trim() || driver.vehicleType,
        rating: driver.rating
      },
      $push: {
        timeline: {
          action: 'DISPATCHED',
          performedBy: 'Dispatcher',
          details: `Ride assigned to ${driver.name} (${driver.driverId})`
        }
      }
    });

    // Update Driver Availability
    await DriverDB.update(drvFilter, {
      availability: 'On Trip'
    });

    return sendSuccess(res, {
      ...newAssignment,
      request,
      driver
    }, `Ride ${request.requestId} successfully assigned to ${driver.name}`, 201);
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

    let query = {
      $or: [
        { status: 'ASSIGNED' },
        { status: 'IN_PROGRESS' },
        { status: 'Dispatched' },
        { 'assignedDriverDetails.driverCode': { $exists: true } }
      ]
    };

    if (targetDriverId) {
      const isMongoId = targetDriverId.match(/^[0-9a-fA-F]{24}$/);
      const drvFilter = isMongoId ? { _id: targetDriverId } : { driverId: targetDriverId };
      const driver = await DriverDB.findOne(drvFilter);

      if (driver) {
        query = {
          $or: [
            { driverId: driver._id },
            { driverId: driver.driverId },
            { 'assignedDriverDetails.driverCode': driver.driverId },
            { 'assignedDriverDetails.name': driver.name }
          ]
        };
      } else {
        query = {
          $or: [
            { driverId: targetDriverId },
            { 'assignedDriverDetails.driverCode': targetDriverId }
          ]
        };
      }
    }

// @desc    Get all rides with mapped structure & pending/assigned counts
// @route   GET /api/rides
export const getAllRides = async (req, res, next) => {
  try {
    const rawRides = await RequestDB.find({}, { createdAt: -1, updatedAt: -1 }, 0, 200);

    let pendingCount = 0;
    let assignedCount = 0;

    const rides = rawRides.map(r => {
      const isAssigned = r.status === 'ASSIGNED' || (r.status && r.status.startsWith('Dispatched')) || !!r.assignedDriverDetails?.name;
      if (isAssigned) {
        assignedCount++;
      } else {
        pendingCount++;
      }

      const passengerName = r.customerName || r.passenger?.name || 'Passenger';
      const passengerPhone = r.customerPhone || r.passenger?.phone || '+92 300 1234567';
      const pickup = r.pickupLocation || 'Islamabad';
      const drop = r.dropLocation || 'Rawalpindi';
      const vehiclePref = r.vehiclePreference || r.preferences?.vehicleCategory || 'Sedan';
      const acReq = r.acRequired !== false;

      return {
        _id: r._id,
        requestId: r.requestId || `REQ-${String(r._id).slice(-4).toUpperCase()}`,
        passenger: {
          name: passengerName,
          phone: passengerPhone,
          email: r.customerEmail || r.passenger?.email || '',
          gender: r.gender || 'Male'
        },
        route: {
          summary: `${pickup} ➔ ${drop}`,
          pickupLocation: pickup,
          dropLocation: drop,
          passengers: `${r.seatsNeeded || 1} Passenger(s)`
        },
        pickupLocation: pickup,
        dropLocation: drop,
        scheduledTime: `${r.date || ''} ${r.timeToLeave || ''}`.trim() || 'Today 08:00 AM',
        date: `${r.date || ''} ${r.timeToLeave || ''}`.trim() || 'Today 08:00 AM',
        vehicle: {
          category: vehiclePref,
          ac: acReq,
          label: `${vehiclePref}${acReq ? ' • AC' : ' • Non-AC'}`
        },
        preferences: {
          vehicleCategory: vehiclePref,
          acRequired: acReq
        },
        fareFormatted: r.fare || 'Rs. 2,500',
        fare: r.fare || 'Rs. 2,500',
        seatsNeeded: r.seatsNeeded || 1,
        status: isAssigned ? 'ASSIGNED' : 'Pending Dispatch',
        driverId: r.driverId,
        assignedDriverDetails: r.assignedDriverDetails
      };
    });

    return res.status(200).json({
      success: true,
      pendingCount,
      assignedCount,
      totalCount: rides.length,
      data: {
        rides,
        pendingCount,
        assignedCount
      },
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

    const isMongoId = id.match(/^[0-9a-fA-F]{24}$/);
    const reqFilter = isMongoId ? { _id: id } : { requestId: id };
    const request = await RequestDB.findOne(reqFilter);

    if (!request) {
      return sendError(res, `Ride request not found: ${id}`, 404);
    }

    let driver = null;
    if (driverId) {
      const drvMongo = driverId.match(/^[0-9a-fA-F]{24}$/);
      driver = await DriverDB.findOne(drvMongo ? { _id: driverId } : { driverId });
    }

    if (!driver && driverName) {
      driver = await DriverDB.findOne({
        $or: [
          { name: new RegExp(`^${driverName.trim()}$`, 'i') },
          { 'personalInfo.name': new RegExp(`^${driverName.trim()}$`, 'i') }
        ]
      });
    }

    const assignedDriverName = driverName || driver?.name || driver?.personalInfo?.name || 'Assigned Driver';
    const assignedDriverCode = driver?.driverId || driver?.id || `DRV-${String(driver?._id || id).slice(-6).toUpperCase()}`;
    const assignedPhone = driver?.phone || driver?.personalInfo?.phone || '+92 300 0000000';
    const assignedVehicle = driver ? `${driver.vehicleDetails?.make || driver.vehicleInfo?.make || ''} ${driver.vehicleDetails?.model || driver.vehicleInfo?.model || ''}`.trim() || driver.vehicleType || 'Sedan' : 'Vehicle';
    const assignedRating = driver?.rating || driver?.performance?.rating || 4.8;

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


