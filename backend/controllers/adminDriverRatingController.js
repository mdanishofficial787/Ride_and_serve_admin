import Driver from '../models/Driver.js';
import DriverRatingLog from '../models/DriverRatingLog.js';
import { sendSuccess, sendError } from '../middleware/responseHandler.js';

/**
 * GET /admin/ratings
 * Retrieve all drivers with rating metrics, completed rides, and KPI summary
 */
export const getDriversRatings = async (req, res) => {
  try {
    const drivers = await Driver.find({}).sort({ createdAt: -1 }).lean();

    // Fetch all rating logs to calculate monthly metrics & driver history
    const allLogs = await DriverRatingLog.find({}).sort({ createdAt: -1 }).lean();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const logsThisMonth = allLogs.filter(l => new Date(l.createdAt) >= startOfMonth);

    let totalScore = 0;
    let ratedCount = 0;
    let requiringReviewCount = 0;

    const enrichedDrivers = drivers.map(d => {
      const driverLogs = allLogs.filter(l => 
        (l.driver && l.driver.toString() === d._id.toString()) || 
        (l.driverReferenceId && l.driverReferenceId === (d.driverReferenceId || d.driverId))
      );

      const isRated = Boolean(d.rating != null && Number(d.rating) > 0) || driverLogs.length > 0;
      const currentRating = isRated 
        ? Number((driverLogs.length > 0 ? driverLogs[0].score : d.rating).toFixed(1))
        : null;

      if (isRated && currentRating != null) {
        totalScore += currentRating;
        ratedCount++;
        if (currentRating < 3.0) {
          requiringReviewCount++;
        }
      }

      const lastLog = driverLogs[0] || null;
      const lastRatedDate = lastLog?.createdAt || (isRated ? d.updatedAt : null);
      const ratedByName = lastLog?.ratedBy || (isRated ? 'Admin' : null);

      // Authentic completed rides from DB
      const completedRides = d.completedRides || d.totalRides || 0;

      return {
        _id: d._id,
        id: d._id,
        driverId: d.driverReferenceId || d.driverId || `DRV-${d._id.toString().substring(18).toUpperCase()}`,
        name: d.Name || d.name || 'Driver Partner',
        phone: d.PhoneNumber || d.phone || 'N/A',
        email: d.Email || d.email || '',
        photo: d.driverPhoto?.url || d.profilePhoto || d.photo || null,
        status: d.verificationStatus || d.status || 'Pending',
        city: d.city || 'Islamabad',
        completedRides,
        isRated,
        currentRating,
        ratingCount: driverLogs.length,
        lastRated: lastRatedDate,
        ratedBy: ratedByName,
        lastRemarks: lastLog?.adminRemarks || '',
        lastTags: lastLog?.performanceTags || []
      };
    });

    const averageRating = ratedCount > 0 ? Number((totalScore / ratedCount).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      data: {
        drivers: enrichedDrivers,
        kpis: {
          totalRatedDrivers: ratedCount,
          averageRating: averageRating,
          ratedThisMonth: logsThisMonth.length,
          requiringReview: requiringReviewCount
        }
      },
      message: 'Driver ratings retrieved successfully'
    });
  } catch (err) {
    console.error('[DriverRatingController] Error fetching ratings:', err.message);
    return sendError(res, err.message, 500);
  }
};

/**
 * GET /admin/ratings/:driverId/history
 * Retrieve all previous rating logs for a driver
 */
export const getDriverRatingHistory = async (req, res) => {
  try {
    const { driverId } = req.params;

    let driver = await Driver.findById(driverId).lean();
    if (!driver) {
      driver = await Driver.findOne({
        $or: [{ driverReferenceId: driverId }, { driverId: driverId }]
      }).lean();
    }

    const query = driver ? {
      $or: [
        { driver: driver._id },
        { driverReferenceId: driver.driverReferenceId || driver.driverId }
      ]
    } : { driverReferenceId: driverId };

    const logs = await DriverRatingLog.find(query).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      data: {
        driver: driver ? {
          _id: driver._id,
          driverId: driver.driverReferenceId || driver.driverId,
          name: driver.Name || driver.name,
          currentRating: driver.rating || null
        } : null,
        history: logs
      },
      message: 'Rating history retrieved successfully'
    });
  } catch (err) {
    console.error('[DriverRatingController] Error fetching history:', err.message);
    return sendError(res, err.message, 500);
  }
};

/**
 * POST /admin/ratings
 * Admin submits or updates a driver rating
 */
export const submitDriverRating = async (req, res) => {
  try {
    const { driverId, score, performanceTags, adminRemarks } = req.body;

    if (!driverId) {
      return sendError(res, 'Driver ID is required', 400);
    }

    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 1 || numScore > 5) {
      return sendError(res, 'Rating score must be a number between 1.0 and 5.0', 400);
    }

    let driver = await Driver.findById(driverId);
    if (!driver) {
      driver = await Driver.findOne({
        $or: [{ driverReferenceId: driverId }, { driverId: driverId }]
      });
    }

    if (!driver) {
      return sendError(res, 'Driver not found in system', 404);
    }

    const adminName = req.admin?.Name || req.admin?.name || 'Super Admin';
    const adminId = req.admin?._id || null;

    // 1. Create audit rating log
    const ratingLog = await DriverRatingLog.create({
      driver: driver._id,
      driverReferenceId: driver.driverReferenceId || driver.driverId || `DRV-${driver._id.toString().substring(18)}`,
      driverName: driver.Name || driver.name || 'Driver Partner',
      score: numScore,
      performanceTags: Array.isArray(performanceTags) ? performanceTags : [],
      adminRemarks: adminRemarks || '',
      ratedBy: adminName,
      ratedByAdminId: adminId
    });

    // 2. Update Driver model with new rating
    driver.rating = numScore;
    driver.lastRatedAt = new Date();
    driver.lastRatedBy = adminName;
    await driver.save();

    return res.status(200).json({
      success: true,
      message: `Driver rating of ${numScore}★ recorded successfully by Admin`,
      data: {
        driver: {
          _id: driver._id,
          name: driver.Name || driver.name,
          rating: driver.rating,
          lastRatedAt: driver.lastRatedAt
        },
        ratingLog
      }
    });
  } catch (err) {
    console.error('[DriverRatingController] Error submitting rating:', err.message);
    return sendError(res, err.message, 500);
  }
};
