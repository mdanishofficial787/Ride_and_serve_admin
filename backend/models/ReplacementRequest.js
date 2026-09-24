import mongoose from 'mongoose';

const replacementRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    trim: true,
    unique: true
  },
  clientName: {
    type: String,
    required: true,
    trim: true
  },
  clientPhone: {
    type: String,
    required: true,
    trim: true
  },
  clientEmail: {
    type: String,
    trim: true,
    default: ''
  },
  scheduledDate: {
    type: String,
    required: true,
    trim: true
  },
  timeSlot: {
    type: String,
    required: true,
    trim: true
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    default: 'Vehicle Issue'
  },
  preferences: {
    vehicleArrangement: {
      type: String,
      default: 'Separate' // Separate / Shared
    },
    vehicleType: {
      type: String,
      default: 'Sedan Executive'
    },
    genderPreference: {
      type: String,
      default: 'Male Only' // Male Only / Female Only / No Preference
    },
    acPreference: {
      type: String,
      default: 'AC' // AC / Non-AC
    }
  },
  additionalNotes: {
    type: String,
    default: 'Driver is unavailable due to vehicle issue.'
  },
  status: {
    type: String,
    enum: ['Pending', 'ASSIGNED', 'Rejected', 'CANCELLED'],
    default: 'Pending'
  },
  pickupLocation: {
    type: String,
    default: 'Blue Area, Islamabad'
  },
  dropoffLocation: {
    type: String,
    default: 'F-10 Markaz, Islamabad'
  },
  fare: {
    type: Number,
    default: 4500
  },
  fareFormatted: {
    type: String,
    default: 'Rs. 4,500'
  },
  assignedDriver: {
    driverId: { type: mongoose.Schema.Types.Mixed, default: null },
    driverCode: { type: String, default: null },
    name: { type: String, default: null },
    phone: { type: String, default: null },
    vehicle: { type: String, default: 'Sedan Executive' },
    ac: { type: Boolean, default: true },
    assignedAt: { type: Date, default: null }
  }
}, {
  timestamps: true,
  collection: 'replacementrequests'
});

const ReplacementRequest = mongoose.models.ReplacementRequest || mongoose.model('ReplacementRequest', replacementRequestSchema);
export default ReplacementRequest;
