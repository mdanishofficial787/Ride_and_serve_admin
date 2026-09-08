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
