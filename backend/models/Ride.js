import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  rideId: {
    type: String,
    index: true
  },
  pickupLocation: {
    address: String,
    lat: Number,
    lng: Number
  },
  dropoffLocation: {
    address: String,
    lat: Number,
    lng: Number
  },
  dropLocation: {
    address: String,
    lat: Number,
    lng: Number
  },
  status: {
    type: String,
    default: 'pending',
    index: true
  },
  fare: {
    type: mongoose.Schema.Types.Mixed,
    default: 'Rs. 2,500'
  },
  rideType: {
    type: String,
    default: 'Standard'
  },
  seatsNeeded: {
    type: Number,
    default: 1
  },
  vehiclePreference: {
    type: String,
    default: 'Sedan'
  },
  acRequired: {
    type: Boolean,
    default: true
  },
  assignedDriverDetails: {
    driverCode: String,
    name: String,
    phone: String,
    vehicle: String,
    rating: Number
  },
  timeline: [{
    action: String,
    timestamp: { type: Date, default: Date.now },
    performedBy: String,
    details: String
  }]
}, {
  timestamps: true,
  strict: false,
  collection: 'rides'
});

const Ride = mongoose.models.Ride || mongoose.model('Ride', rideSchema, 'rides');

export default Ride;
