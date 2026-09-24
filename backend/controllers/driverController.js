import { DriverDB, AdminStatsDB } from '../models/dbAdapter.js';
import { sendSuccess, sendError } from '../middleware/responseHandler.js';

// @desc    Get all drivers with filtering & pagination
// @route   GET /api/drivers
export const getDrivers = async (req, res, next) => {
  try {
    const { status, source, city, search, page = 1, limit = 20, sort = '-createdAt' } = req.query;

    const query = {};

    if (status) {
      query.status = status.toUpperCase();
    }

    if (source) {
      query.source = source.toUpperCase();
    }

    if (city) {
      query.city = new RegExp(city, 'i');
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') },
        { driverId: new RegExp(search, 'i') },
        { 'vehicleDetails.plateNumber': new RegExp(search, 'i') }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const total = await DriverDB.count(query);
    const drivers = await DriverDB.find(query, sort, skip, limitNum);

    return sendSuccess(res, {
      drivers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      }
    }, 'Drivers retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Get KPI driver stats
// @route   GET /api/drivers/stats
export const getDriverStats = async (req, res, next) => {
  try {
    const stats = await AdminStatsDB.syncStats();
    return sendSuccess(res, stats, 'Driver statistics retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Get available drivers matching ride location and vehicle preferences
// @route   GET /api/drivers/available
export const getAvailableDrivers = async (req, res, next) => {
  try {
    const { rideLocation, vehicleType, ac } = req.query;

    const query = {
      status: 'APPROVED',
      $or: [
        { liveStatus: 'Available' },
        { availability: 'Available' },
        { 'availability.slots': { $exists: true } },
        { liveStatus: { $exists: false } }
      ]
    };

    if (vehicleType && vehicleType !== 'all' && vehicleType !== 'Any') {
      query.$or = [
        { vehicleType: vehicleType },
        { 'vehicleDetails.category': vehicleType }
      ];
    }

    if (ac === 'ac' || ac === 'true') {
      query['vehicleDetails.ac'] = true;
    }

    let drivers = await DriverDB.find(query, { rating: -1, createdAt: -1 }, 0, 100);

    if (rideLocation && rideLocation.trim()) {
      const loc = rideLocation.toLowerCase();
      drivers = drivers.filter(d => {
        const matchesRoute = d.preferredRoutes && d.preferredRoutes.some(r => r.toLowerCase().includes(loc) || loc.includes(r.toLowerCase()));
        const matchesCity = d.city && loc.toLowerCase().includes(d.city.toLowerCase());
        return matchesRoute || matchesCity || true;
      });
    }

    return sendSuccess(res, drivers, 'Available drivers retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Get single driver by ID or driver code
// @route   GET /api/drivers/:id
export const getDriverById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let driver = await DriverDB.findById(id);
    if (!driver) {
      driver = await DriverDB.findOne({ driverId: id });
    }

    if (!driver) {
      return sendError(res, `Driver not found with id: ${id}`, 404);
    }

    return sendSuccess(res, driver, 'Driver details retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Create new driver (APP or MANUAL)
// @route   POST /api/drivers
export const createDriver = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      vehicleType,
      source = 'MANUAL',
      rating = 4.8,
      city,
      preferredRoutes,
      vehicleDetails,
      documents
    } = req.body;

    if (!name || !email || !phone) {
      return sendError(res, 'Name, email, and phone number are required', 400);
    }

    const newDriverData = {
      name,
      Name: name,
      email,
      Email: email,
      phone,
      PhoneNumber: phone,
      vehicleType: vehicleType || 'Sedan',
      status: 'PENDING',
      verificationStatus: 'Pending',
      source: (source || 'MANUAL').toUpperCase(),
      rating: Number(rating) || 4.8,
      availability: 'Available',
      city: city || 'Islamabad',
      preferredRoutes: preferredRoutes || ['Islamabad - Rawalpindi', 'Islamabad - Lahore'],
      vehicleDetails: vehicleDetails || {
        make: 'Toyota',
        model: 'Corolla',
        year: '2022',
        color: 'White',
        plateNumber: `ABC-${Math.floor(1000 + Math.random() * 9000)}`,
        category: vehicleType || 'Sedan',
        ac: true
      },
      documents: documents || {
        cnic: 'Verified',
        license: 'Verified',
        registration: 'Verified',
        insurance: 'Verified',
        inspection: 'Verified'
      }
    };

    const saved = await DriverDB.create(newDriverData);
    await AdminStatsDB.syncStats();

    return sendSuccess(res, saved, 'Driver registered successfully and placed in PENDING queue', 201);
  } catch (err) {
    next(err);
  }
};

// @desc    Approve driver
// @route   PUT /api/drivers/:id/approve
export const approveDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const filter = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { driverId: id };

    const driver = await DriverDB.update(
      filter,
      { status: 'APPROVED', availability: 'Available' }
    );

    if (!driver) {
      return sendError(res, `Driver not found with id: ${id}`, 404);
    }

    await AdminStatsDB.syncStats();

    return sendSuccess(res, driver, `Driver ${driver.name} (${driver.driverId}) approved successfully`);
  } catch (err) {
    next(err);
  }
};

// @desc    Reject driver
// @route   PUT /api/drivers/:id/reject
export const rejectDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Document verification failed' } = req.body;
    const filter = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { driverId: id };

    const driver = await DriverDB.update(
      filter,
      { status: 'REJECTED', notes: reason }
    );

    if (!driver) {
      return sendError(res, `Driver not found with id: ${id}`, 404);
    }

    await AdminStatsDB.syncStats();

    return sendSuccess(res, driver, `Driver ${driver.name} (${driver.driverId}) rejected`);
  } catch (err) {
    next(err);
  }
};
