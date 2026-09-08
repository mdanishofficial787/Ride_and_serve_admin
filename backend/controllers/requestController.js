import { RequestDB, RideDB, formatRideRecord } from '../models/dbAdapter.js';
import { sendSuccess, sendError } from '../middleware/responseHandler.js';

// @desc    Get all requests / rides with filtering & pagination
// @route   GET /api/requests
export const getRequests = async (req, res, next) => {
  try {
    const {
      status,
      visibility,
      source,
      search,
      page = 1,
      limit = 30,
      sort = '-createdAt'
    } = req.query;

    const query = {};

    if (status && status !== 'All') {
      if (status === 'DriverRequests') {
        query['driverRequests.0'] = { $exists: true };
      } else {
        query.status = status;
      }
    }

    if (visibility) {
      query.visibility = visibility.toUpperCase();
    }

    if (source) {
      query.source = source.toUpperCase();
    }

    if (search) {
      query.$or = [
        { customerName: new RegExp(search, 'i') },
        { pickupLocation: new RegExp(search, 'i') },
        { dropLocation: new RegExp(search, 'i') },
        { requestId: new RegExp(search, 'i') },
        { vehiclePreference: new RegExp(search, 'i') }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 30;
    const skip = (pageNum - 1) * limitNum;

    // Query both collections: customer mobile rides and manual admin requests
    const rawRides = await RideDB.find({}, sort, 0, 100);
    const rawRequests = await RequestDB.find(query, sort, skip, limitNum);

    const formattedRides = (rawRides || []).map(formatRideRecord);
    const formattedRequests = (rawRequests || []).map(formatRideRecord);

    // Merge customer rides and requests, removing any duplicates by _id
    const idMap = new Map();
    [...formattedRides, ...formattedRequests].forEach(r => {
      if (r && r._id) {
        idMap.set(String(r._id), r);
      }
    });

    let merged = Array.from(idMap.values());

    if (search) {
      const s = search.toLowerCase();
      merged = merged.filter(r => 
        (r.customerName && r.customerName.toLowerCase().includes(s)) ||
        (r.pickupLocation && r.pickupLocation.toLowerCase().includes(s)) ||
        (r.dropLocation && r.dropLocation.toLowerCase().includes(s)) ||
        (r.requestId && r.requestId.toLowerCase().includes(s))
      );
    }

    const total = merged.length;
    const pagedRequests = merged.slice(skip, skip + limitNum);

    return sendSuccess(res, {
      requests: pagedRequests,
      rides: pagedRequests,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      }
    }, 'Ride requests retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Get pending rides queue (for Pending Rides Monitor screen / Driver Dispatch)
// @route   GET /api/requests/pending, GET /api/ride/pending
export const getPendingRides = async (req, res, next) => {
  try {
    const { filterStatus = 'All', search = '' } = req.query;

    // 1. Fetch rides from `rides` collection (Customer App)
    const rawCustomerRides = await RideDB.find({
      $or: [
        { status: 'pending' },
        { status: 'PENDING' },
        { status: 'Visible' },
        { status: 'Waiting for Driver' },
        { status: { $exists: false } }
      ]
    }, { createdAt: -1 }, 0, 100);

    // 2. Fetch requests from `requests` collection (Admin Manual)
    const query = {
      $and: [
        { status: { $ne: 'ASSIGNED' } },
        { status: { $ne: 'COMPLETED' } },
        { status: { $ne: 'CANCELLED' } },
        { status: { $not: /^Dispatched/ } }
      ]
    };

    if (filterStatus && filterStatus !== 'All') {
      query.status = filterStatus;
    }

    const rawRequests = await RequestDB.find(query, { isOverdue: -1, createdAt: -1 }, 0, 100);

    // 3. Format and merge both sources
    const formattedRides = (rawCustomerRides || []).map(formatRideRecord);
    const formattedRequests = (rawRequests || []).map(formatRideRecord);

    const idMap = new Map();
    [...formattedRides, ...formattedRequests].forEach(r => {
      if (r && r._id && r.status !== 'ASSIGNED' && !String(r.status).startsWith('Dispatched')) {
        idMap.set(String(r._id), r);
      }
    });

    let rides = Array.from(idMap.values());

    if (search) {
      const s = search.toLowerCase();
      rides = rides.filter(r => 
        (r.customerName && r.customerName.toLowerCase().includes(s)) ||
        (r.pickupLocation && r.pickupLocation.toLowerCase().includes(s)) ||
        (r.dropLocation && r.dropLocation.toLowerCase().includes(s)) ||
        (r.requestId && r.requestId.toLowerCase().includes(s))
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Pending rides retrieved successfully',
      data: {
        rides,
        total: rides.length
      },
      rides,
      total: rides.length
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get ride stats for Ride Pool & Dashboard
// @route   GET /api/requests/stats
export const getRequestStats = async (req, res, next) => {
  try {
    const totalRequests = await RequestDB.count();
    const totalCustomerRides = await RideDB.count();
    const totalRides = totalRequests + totalCustomerRides;

    const availableRides = await RequestDB.count({
      $or: [{ status: 'Visible' }, { visibility: 'VISIBLE', status: { $ne: 'ASSIGNED' } }]
    }) + await RideDB.count({ status: 'pending' });

    const assignedRides = await RequestDB.count({
      $or: [{ status: 'ASSIGNED' }, { status: 'COMPLETED' }, { status: /^Dispatched/ }]
    }) + await RideDB.count({ status: 'ASSIGNED' });

    const cancelledRides = await RequestDB.count({ status: 'CANCELLED' }) + await RideDB.count({ status: 'CANCELLED' });

    const allRides = await RequestDB.find({}, null, 0, 1000);
    const driverRequestsCount = allRides.reduce((acc, r) => acc + (r.driverRequests?.length || 0), 0);

    return sendSuccess(res, {
      totalRides,
      availableRides,
      driverRequestsCount,
      assignedRides,
      cancelledRides,
      updatedAt: new Date()
    }, 'Ride statistics retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Get single request by ID or requestId
// @route   GET /api/requests/:id
export const getRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check RideDB first
    let ride = await RideDB.findById(id);
    if (!ride) {
      ride = await RideDB.findOne({ rideId: id });
    }
    if (ride) {
      return sendSuccess(res, formatRideRecord(ride), 'Ride details retrieved successfully');
    }

    // Check RequestDB
    let request = await RequestDB.findById(id);
    if (!request) {
      request = await RequestDB.findOne({ requestId: id });
    }

    if (!request) {
      return sendError(res, `Ride request not found with id: ${id}`, 404);
    }

    return sendSuccess(res, formatRideRecord(request), 'Ride request details retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Create new ride request (Admin Manual or App)
// @route   POST /api/requests
export const createRequest = async (req, res, next) => {
  try {
    const {
      customerName,
      pickupLocation,
      dropLocation,
      fare,
      date,
      timeToLeave,
      timeToReach,
      seatsNeeded,
      vehiclePreference,
      acRequired,
      oneWay,
      publishToPool,
      source = 'MANUAL',
      status,
      visibility,
      notes
    } = req.body;

    if (!customerName || !pickupLocation || !dropLocation) {
      return sendError(res, 'Passenger name, pickup location, and drop-off location are required', 400);
    }

    const isPublished = publishToPool !== undefined ? publishToPool : true;
    const finalVisibility = visibility || (isPublished ? 'VISIBLE' : 'HIDDEN');
    const finalStatus = status || (isPublished ? 'Visible' : 'Draft');

    const newRequestData = {
      customerName,
      pickupLocation,
      dropLocation,
      fare: fare || 'Rs. 9,500',
      date: date || new Date().toISOString().split('T')[0],
      timeToLeave: timeToLeave || '08:00 AM',
      timeToReach: timeToReach || '09:00 AM',
      seatsNeeded: Number(seatsNeeded) || 1,
      vehiclePreference: vehiclePreference || 'Sedan',
      acRequired: acRequired !== undefined ? acRequired : true,
      oneWay: oneWay !== undefined ? oneWay : true,
      status: finalStatus,
      visibility: finalVisibility,
      source: (source || 'MANUAL').toUpperCase(),
      notes: notes || '',
      timeline: [{
        action: 'CREATED',
        performedBy: 'Admin (Manual)',
        details: `Ride created: ${pickupLocation} -> ${dropLocation}`
      }]
    };

    const saved = await RequestDB.create(newRequestData);

    return sendSuccess(res, formatRideRecord(saved), `Ride request ${saved.requestId} created successfully`, 201);
  } catch (err) {
    next(err);
  }
};

// @desc    Update ride request
// @route   PUT /api/requests/:id
export const updateRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const filter = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { requestId: id };

    let updated = await RequestDB.update(
      filter,
      {
        ...updateData,
        $push: {
          timeline: {
            action: 'UPDATED',
            performedBy: 'Admin',
            details: 'Ride details updated'
          }
        }
      }
    );

    if (!updated) {
      const rideFilter = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { rideId: id };
      updated = await RideDB.update(rideFilter, updateData);
    }

    if (!updated) {
      return sendError(res, `Ride request not found with id: ${id}`, 404);
    }

    return sendSuccess(res, formatRideRecord(updated), `Ride updated successfully`);
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle ride visibility (VISIBLE/HIDDEN)
// @route   PUT /api/requests/:id/visibility
export const toggleVisibility = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { visibility } = req.body;

    const filter = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { requestId: id };
    const request = await RequestDB.findOne(filter);

    if (!request) {
      return sendError(res, `Ride request not found with id: ${id}`, 404);
    }

    const nextVisibility = visibility || (request.visibility === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE');
    const nextStatus = nextVisibility === 'VISIBLE' ? 'Visible' : 'Draft';

    const updated = await RequestDB.update(filter, {
      visibility: nextVisibility,
      status: nextStatus,
      $push: {
        timeline: {
          action: 'VISIBILITY_CHANGED',
          performedBy: 'Admin',
          details: `Visibility toggled to ${nextVisibility}`
        }
      }
    });

    return sendSuccess(res, formatRideRecord(updated), `Ride visibility updated to ${nextVisibility}`);
  } catch (err) {
    next(err);
  }
};

// @desc    Get driver bids/requests for a specific ride
// @route   GET /api/requests/:id/driver-requests
export const getDriverRequestsForRide = async (req, res, next) => {
  try {
    const { id } = req.params;

    const filter = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { requestId: id };
    const request = await RequestDB.findOne(filter);

    if (!request) {
      return sendError(res, `Ride request not found with id: ${id}`, 404);
    }

    return sendSuccess(res, {
      requestId: request.requestId,
      route: `${request.pickupLocation} -> ${request.dropLocation}`,
      driverRequests: request.driverRequests || []
    }, 'Driver requests for ride retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Delete/Cancel a ride request
// @route   DELETE /api/requests/:id
export const deleteRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const filter = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { requestId: id };
    
    const existing = await RequestDB.findOne(filter);
    if (!existing) {
      return sendError(res, `Ride request not found with id: ${id}`, 404);
    }

    await RequestDB.deleteOne(filter);
    return sendSuccess(res, { requestId: existing.requestId }, `Ride request ${existing.requestId} deleted successfully`);
  } catch (err) {
    next(err);
  }
};
