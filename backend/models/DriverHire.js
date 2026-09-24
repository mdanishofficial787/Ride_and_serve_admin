import mongoose from 'mongoose';

const driverHireSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.Mixed,
    ref: 'Customer',
    default: null
  },
  requestId: {
    type: String,
    trim: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerPhone: {
    type: String,
    required: true,
    trim: true
  },
  customerEmail: {
    type: String,
    trim: true,
    default: ''
  },
  cnic: {
    type: String,
    trim: true,
    default: ''
  },
  bookingDate: {
    type: String,
    trim: true
  },
  pickupLocation: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  dropoffLocation: {
    type: mongoose.Schema.Types.Mixed,
    default: ''
  },
  timeToReach: {
    type: String,
    default: ''
  },
  offTime: {
    type: String,
    default: ''
  },
  fare: {
    type: Number,
    default: 3500
  },
  fareFormatted: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending Dispatch', 'Pending', 'ASSIGNED', 'ACCEPTED', 'ON TRIP', 'COMPLETED', 'CANCELLED'],
    default: 'Pending Dispatch'
  },
  assignedDriverId: {
    type: mongoose.Schema.Types.Mixed,
    ref: 'Driver',
    default: null
  },
  assignedDriverName: {
    type: String,
    default: null
  },
  assignedDriverPhone: {
    type: String,
    default: null
  },
  assignedDriverCode: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  dispatchedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'driverhirerequests'
});

const DriverHire = mongoose.models.DriverHire || mongoose.model('DriverHire', driverHireSchema);
export default DriverHire;
