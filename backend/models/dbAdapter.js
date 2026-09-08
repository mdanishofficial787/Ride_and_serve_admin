import mongoose from 'mongoose';
import DriverModel from './Driver.js';
import RequestModel from './Request.js';
import RideModel from './Ride.js';
import CustomerModel from './Customer.js';
import AssignmentModel from './Assignment.js';
import AdminStatsModel from './AdminStats.js';
import { isMemoryMode, memoryStore } from '../config/db.js';

const generateId = (prefix = 'ID') => `${prefix}-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
const generateMongoId = () => new mongoose.Types.ObjectId().toString();

// ==========================================
// RIDE / REQUEST NORMALIZER
// ==========================================
export const formatRideRecord = (r) => {
  if (!r) return null;
  const isPlain = typeof r.toObject === 'function' ? r.toObject() : r;
  const cust = isPlain.customer || {};
  const drv = isPlain.driver || isPlain.driverId || {};

  const pickup = typeof isPlain.pickupLocation === 'object' && isPlain.pickupLocation !== null
    ? (isPlain.pickupLocation.address || 'Pickup')
    : (isPlain.pickupLocation || 'Pickup');

  const drop = typeof isPlain.dropoffLocation === 'object' && isPlain.dropoffLocation !== null
    ? (isPlain.dropoffLocation.address || 'Drop-off')
    : (typeof isPlain.dropLocation === 'object' && isPlain.dropLocation !== null
      ? (isPlain.dropLocation.address || 'Drop-off')
      : (isPlain.dropoffLocation || isPlain.dropLocation || 'Drop-off'));

  const custName = cust.fullName || cust.name || isPlain.customerName || isPlain.passenger?.name || 'Customer';
  const custPhone = cust.PhoneNumber || cust.phone || isPlain.customerPhone || isPlain.passenger?.phone || '';
  const custEmail = cust.Email || cust.email || isPlain.customerEmail || isPlain.passenger?.email || '';

  const fareFormatted = isPlain.fare !== undefined && isPlain.fare !== null
    ? (typeof isPlain.fare === 'number' ? `AED ${isPlain.fare}` : String(isPlain.fare).startsWith('AED') || String(isPlain.fare).startsWith('Rs') ? String(isPlain.fare) : `Rs. ${isPlain.fare}`)
    : 'AED 45';

  const isAssigned = isPlain.status === 'ASSIGNED' || isPlain.status === 'assigned' || (isPlain.status && String(isPlain.status).startsWith('Dispatched'));

  const dateStr = isPlain.date || (isPlain.createdAt ? new Date(isPlain.createdAt).toLocaleDateString() : 'Today');
  const timeStr = isPlain.timeToLeave || (isPlain.createdAt ? new Date(isPlain.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:00 AM');

  return {
    _id: isPlain._id,
    id: isPlain.requestId || isPlain.rideId || `REQ-${String(isPlain._id).slice(-4).toUpperCase()}`,
    requestId: isPlain.requestId || isPlain.rideId || `REQ-${String(isPlain._id).slice(-4).toUpperCase()}`,
    rideId: isPlain.rideId || isPlain.requestId || `REQ-${String(isPlain._id).slice(-4).toUpperCase()}`,
    customerName: custName,
    customerPhone: custPhone,
    customerEmail: custEmail,
    passengerName: custName,
    passengerPhone: custPhone,
    passengerEmail: custEmail,
    passenger: {
      name: custName,
      phone: custPhone,
      email: custEmail,
      gender: cust.gender || isPlain.gender || 'Male'
    },

    pickupLocation: pickup,
    dropLocation: drop,
    dropoffLocation: drop,
    route: {
      summary: `${pickup} ➔ ${drop}`,
      pickupLocation: pickup,
      dropLocation: drop,
      passengers: `${isPlain.seatsNeeded || 1} Passenger(s)`
    },
    date: dateStr,
    timeToLeave: timeStr,
    scheduledTime: `${dateStr} ${timeStr}`.trim(),
    fare: fareFormatted,
    fareFormatted: fareFormatted,
    seatsNeeded: isPlain.seatsNeeded || 1,
    rideType: isPlain.rideType || 'Standard',
    vehiclePreference: isPlain.vehiclePreference || 'Sedan',
    acRequired: isPlain.acRequired !== false,
    status: isAssigned ? 'ASSIGNED' : 'Pending Dispatch',
    rawStatus: isPlain.status,
    driver: isPlain.driver || isPlain.driverId || null,
    driverId: isPlain.driver || isPlain.driverId || null,
    assignedDriverDetails: isPlain.assignedDriverDetails || (drv._id ? {
      name: drv.Name || drv.name,
      phone: drv.PhoneNumber || drv.phone,
      driverCode: drv.driverReferenceId || drv.driverId
    } : null),
    source: isPlain.source || 'APP',
    createdAt: isPlain.createdAt,
    updatedAt: isPlain.updatedAt
  };
};

// ==========================================
// RIDE ADAPTER (Customer App rides collection)
// ==========================================
export const RideDB = {
  async count(query = {}) {
    if (!isMemoryMode) return await RideModel.countDocuments(query);
    return memoryStore.requests.filter(r => matchQuery(r, query)).length;
  },

  async find(query = {}, sort = '-createdAt', skip = 0, limit = 50) {
    if (!isMemoryMode) {
      return await RideModel.find(query).populate('customer').populate('driver').sort(sort).skip(skip).limit(limit);
    }
    return [];
  },

  async findOne(filter = {}) {
    if (!isMemoryMode) return await RideModel.findOne(filter).populate('customer').populate('driver');
    return null;
  },

  async findById(id) {
    if (!isMemoryMode) return await RideModel.findById(id).populate('customer').populate('driver');
    return null;
  },

  async update(filter, updateData) {
    if (!isMemoryMode) {
      return await RideModel.findOneAndUpdate(filter, updateData, { new: true });
    }
    return null;
  }
};

// ==========================================
// DRIVER ADAPTER
// ==========================================
export const DriverDB = {
  async count(query = {}) {
    if (!isMemoryMode) return await DriverModel.countDocuments(query);
    return memoryStore.drivers.filter(d => matchQuery(d, query)).length;
  },

  async find(query = {}, sort = '-createdAt', skip = 0, limit = 50) {
    if (!isMemoryMode) {
      return await DriverModel.find(query).sort(sort).skip(skip).limit(limit);
    }
    let list = memoryStore.drivers.filter(d => matchQuery(d, query));
    list = sortList(list, sort);
    return list.slice(skip, skip + limit);
  },

  async findOne(filter = {}) {
    if (!isMemoryMode) return await DriverModel.findOne(filter);
    return memoryStore.drivers.find(d => matchQuery(d, filter)) || null;
  },

  async findById(id) {
    if (!isMemoryMode) return await DriverModel.findById(id);
    return memoryStore.drivers.find(d => d._id?.toString() === id || d.driverId === id) || null;
  },

  async create(data) {
    if (!isMemoryMode) {
      const doc = new DriverModel(data);
      return await doc.save();
    }
    const _id = generateMongoId();
    const count = memoryStore.drivers.length;
    const driverId = data.driverId || `DRV-${1000 + count + 1}`;
    const newDoc = {
      _id,
      driverId,
      ...data,
      rating: data.rating || 4.8,
      status: data.status || 'PENDING',
      availability: data.availability || 'Available',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.drivers.push(newDoc);
    return newDoc;
  },

  async update(filter, updateData) {
    if (!isMemoryMode) {
      return await DriverModel.findOneAndUpdate(filter, updateData, { new: true });
    }
    const idx = memoryStore.drivers.findIndex(d => matchQuery(d, filter));
    if (idx === -1) return null;
    memoryStore.drivers[idx] = {
      ...memoryStore.drivers[idx],
      ...updateData,
      updatedAt: new Date()
    };
    return memoryStore.drivers[idx];
  },

  async deleteMany(filter = {}) {
    if (!isMemoryMode) return await DriverModel.deleteMany(filter);
    memoryStore.drivers = [];
    return { acknowledged: true };
  },

  async insertMany(docs) {
    if (!isMemoryMode) return await DriverModel.insertMany(docs);
    const inserted = docs.map((d, i) => ({
      _id: generateMongoId(),
      driverId: d.driverId || `DRV-${1000 + memoryStore.drivers.length + i + 1}`,
      ...d,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    memoryStore.drivers.push(...inserted);
    return inserted;
  }
};

// ==========================================
// REQUEST (RIDE) ADAPTER
// ==========================================
export const RequestDB = {
  async count(query = {}) {
    if (!isMemoryMode) return await RequestModel.countDocuments(query);
    return memoryStore.requests.filter(r => matchQuery(r, query)).length;
  },

  async find(query = {}, sort = '-createdAt', skip = 0, limit = 50) {
    if (!isMemoryMode) {
      const testList = await RequestModel.find(query).populate('driverId').sort(sort).skip(skip).limit(limit).lean();
      try {
        const client = mongoose.connection?.client;
        if (client) {
          const appReqs = await client.db('ride_and_serve').collection('riderequests').find({}).sort({ createdAt: -1 }).limit(limit).toArray();
          const map = new Map();
          testList.forEach(r => map.set(r.requestId || String(r._id), r));
          appReqs.forEach(r => {
            const key = r.requestId || String(r._id);
            if (!map.has(key)) {
              map.set(key, {
                _id: r._id,
                requestId: r.requestId,
                customerName: r.passengerName || 'Customer',
                passengerName: r.passengerName || 'Customer',
                passengerPhone: r.passengerPhone || '',
                pickupLocation: r.pickupLocation || '',
                dropLocation: r.dropoffLocation || r.dropLocation || '',
                dropoffLocation: r.dropoffLocation || r.dropLocation || '',
                fare: typeof r.fare === 'number' ? `Rs. ${r.fare.toLocaleString()}` : (r.fare || 'Rs. 9,500'),
                fareFormatted: typeof r.fare === 'number' ? `Rs. ${r.fare.toLocaleString()}` : (r.fare || 'Rs. 9,500'),
                scheduledTime: (r.startingFrom ? `${r.startingFrom} ` : '') + (r.timeToReach || r.scheduleTime || '08:30 AM'),
                status: r.status || 'Pending Dispatch',
                vehiclePreference: r.vehicleType || 'Sedan',
                acRequired: (r.acPreference || 'AC').toUpperCase().includes('AC'),
                createdAt: r.createdAt || new Date()
              });
            }
          });
          return Array.from(map.values());
        }
      } catch (e) {}
      return testList;
    }
    let list = memoryStore.requests.filter(r => matchQuery(r, query));
    list = sortList(list, sort);
    return list.slice(skip, skip + limit);
  },

  async findOne(filter = {}) {
    if (!isMemoryMode) return await RequestModel.findOne(filter).populate('driverId');
    return memoryStore.requests.find(r => matchQuery(r, filter)) || null;
  },

  async findById(id) {
    if (!isMemoryMode) return await RequestModel.findById(id).populate('driverId');
    return memoryStore.requests.find(r => r._id?.toString() === id || r.requestId === id) || null;
  },

  async create(data) {
    if (!isMemoryMode) {
      const doc = new RequestModel(data);
      return await doc.save();
    }
    const _id = generateMongoId();
    const count = memoryStore.requests.length;
    const requestId = data.requestId || `REQ-${8000 + count + 1}`;
    const newDoc = {
      _id,
      requestId,
      ...data,
      driverRequests: data.driverRequests || [],
      timeline: data.timeline || [{ action: 'CREATED', timestamp: new Date(), details: 'Ride created' }],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.requests.push(newDoc);
    return newDoc;
  },

  async update(filter, updateData) {
    if (!isMemoryMode) {
      return await RequestModel.findOneAndUpdate(filter, updateData, { new: true });
    }
    const idx = memoryStore.requests.findIndex(r => matchQuery(r, filter));
    if (idx === -1) return null;
    const existing = memoryStore.requests[idx];

    let newTimeline = existing.timeline || [];
    if (updateData.$push?.timeline) {
      newTimeline.push(updateData.$push.timeline);
    }

    const { $push, ...rest } = updateData;

    memoryStore.requests[idx] = {
      ...existing,
      ...rest,
      timeline: newTimeline,
      updatedAt: new Date()
    };
    return memoryStore.requests[idx];
  },

  async deleteOne(filter = {}) {
    if (!isMemoryMode) return await RequestModel.findOneAndDelete(filter);
    const idx = memoryStore.requests.findIndex(r => matchQuery(r, filter));
    if (idx === -1) return null;
    const removed = memoryStore.requests.splice(idx, 1)[0];
    return removed;
  },

  async deleteMany(filter = {}) {
    if (!isMemoryMode) return await RequestModel.deleteMany(filter);
    memoryStore.requests = [];
    return { acknowledged: true };
  },

  async insertMany(docs) {
    if (!isMemoryMode) return await RequestModel.insertMany(docs);
    const inserted = docs.map((r, i) => ({
      _id: generateMongoId(),
      requestId: r.requestId || `REQ-${8000 + memoryStore.requests.length + i + 1}`,
      ...r,
      driverRequests: r.driverRequests || [],
      timeline: r.timeline || [{ action: 'CREATED', timestamp: new Date(), details: 'Initial ride record' }],
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    memoryStore.requests.push(...inserted);
    return inserted;
  }
};

// ==========================================
// ASSIGNMENT ADAPTER
// ==========================================
export const AssignmentDB = {
  async count(query = {}) {
    if (!isMemoryMode) return await AssignmentModel.countDocuments(query);
    return memoryStore.assignments.filter(a => matchQuery(a, query)).length;
  },

  async find(query = {}, sort = '-createdAt', skip = 0, limit = 50) {
    if (!isMemoryMode) {
      return await AssignmentModel.find(query).populate('requestId').populate('driverId').sort(sort).skip(skip).limit(limit);
    }
    let list = memoryStore.assignments.filter(a => matchQuery(a, query));
    list = sortList(list, sort);
    return list.slice(skip, skip + limit);
  },

  async create(data) {
    if (!isMemoryMode) {
      const doc = new AssignmentModel(data);
      return await doc.save();
    }
    const _id = generateMongoId();
    const count = memoryStore.assignments.length;
    const assignmentId = `ASG-${5000 + count + 1}`;
    const newDoc = {
      _id,
      assignmentId,
      ...data,
      dispatchedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.assignments.push(newDoc);
    return newDoc;
  },

  async deleteMany(filter = {}) {
    if (!isMemoryMode) return await AssignmentModel.deleteMany(filter);
    memoryStore.assignments = [];
    return { acknowledged: true };
  }
};

// ==========================================
// ADMIN STATS ADAPTER
// ==========================================
export const AdminStatsDB = {
  async syncStats() {
    if (!isMemoryMode) {
      return await AdminStatsModel.syncStats();
    }

    const totalDrivers = memoryStore.drivers.length;
    const pendingApprovals = memoryStore.drivers.filter(d => d.status === 'PENDING').length;
    const approvedDrivers = memoryStore.drivers.filter(d => d.status === 'APPROVED').length;
    const rejectedDrivers = memoryStore.drivers.filter(d => d.status === 'REJECTED').length;

    const totalDecided = approvedDrivers + rejectedDrivers;
    const rateNum = totalDecided > 0 ? Math.round((approvedDrivers / totalDecided) * 100) : 100;

    memoryStore.adminStats = {
      totalDrivers,
      pendingApprovals,
      approvedDrivers,
      rejectedDrivers,
      approvalRate: `${rateNum}%`,
      updatedAt: new Date()
    };

    return memoryStore.adminStats;
  },

  async deleteMany() {
    if (!isMemoryMode) return await AdminStatsModel.deleteMany({});
    memoryStore.adminStats = null;
    return { acknowledged: true };
  }
};

// Helper: Query matcher for in-memory mode
function matchQuery(doc, query) {
  for (const [key, val] of Object.entries(query)) {
    if (key === '$or' && Array.isArray(val)) {
      const orMatched = val.some(subQuery => matchQuery(doc, subQuery));
      if (!orMatched) return false;
      continue;
    }

    if (key === 'driverRequests.0' && val && val.$exists) {
      if (!doc.driverRequests || doc.driverRequests.length === 0) return false;
      continue;
    }

    if (val && typeof val === 'object' && val.$in) {
      const docVal = getNestedValue(doc, key);
      if (!val.$in.includes(docVal)) return false;
      continue;
    }

    if (val && typeof val === 'object' && val.$ne) {
      const docVal = getNestedValue(doc, key);
      if (docVal === val.$ne) return false;
      continue;
    }

    if (val instanceof RegExp) {
      const docVal = getNestedValue(doc, key);
      if (!docVal || !val.test(docVal.toString())) return false;
      continue;
    }

    const docVal = getNestedValue(doc, key);
    if (docVal !== val) return false;
  }
  return true;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function sortList(list, sort) {
  if (!sort) return list;
  const isDesc = typeof sort === 'string' ? sort.startsWith('-') : false;
  const field = typeof sort === 'string' ? (isDesc ? sort.slice(1) : sort) : Object.keys(sort)[0];
  const order = isDesc || (typeof sort === 'object' && sort[field] === -1) ? -1 : 1;

  return [...list].sort((a, b) => {
    const valA = getNestedValue(a, field);
    const valB = getNestedValue(b, field);
    if (valA === valB) return 0;
    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;
    return valA > valB ? order : -order;
  });
}
