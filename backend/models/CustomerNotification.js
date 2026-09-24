import mongoose from 'mongoose';

const customerNotificationSchema = new mongoose.Schema({
  notificationId: {
    type: String,
    unique: true,
    required: true
  },
  type: {
    type: String,
    enum: ['DRIVER_UNAVAILABLE', 'RIDE_UPDATE', 'GENERAL'],
    default: 'DRIVER_UNAVAILABLE'
  },
  title: {
    type: String,
    default: 'Driver Unavailable'
  },
  subtitle: {
    type: String,
    default: 'Your assigned driver is unavailable for this ride.'
  },
  rideId: {
    type: String,
    default: ''
  },
  requestId: {
    type: String,
    default: ''
  },
  issueId: {
    type: String,
    default: ''
  },
  driverId: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  driverName: {
    type: String,
    default: 'Assigned Driver'
  },
  driverPhone: {
    type: String,
    default: ''
  },
  passengerName: {
    type: String,
    default: 'Customer'
  },
  passengerPhone: {
    type: String,
    default: ''
  },
  affectedDate: {
    type: String,
    default: 'May 21, 2026'
  },
  affectedTime: {
    type: String,
    default: '08:00 AM - 10:00 AM'
  },
  reportedReason: {
    type: String,
    default: 'Reported Reason: Vehicle Issue'
  },
  reason: {
    type: String,
    default: 'Vehicle Issue'
  },
  additionalDetails: {
    type: String,
    default: 'Driver is unavailable due to a sudden mechanical issue with the vehicle. We apologize for the inconvenience and are working to find a replacement driver immediately. The issue is severe enough to prevent the ride.'
  },
  details: {
    type: String,
    default: ''
  },
  canRequestReplacement: {
    type: Boolean,
    default: true
  },
  replacementRequested: {
    type: Boolean,
    default: false
  },
  replacementRequestId: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    default: 'UNAVAILABLE'
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'customernotifications'
});

const CustomerNotification = mongoose.models.CustomerNotification || mongoose.model('CustomerNotification', customerNotificationSchema);

export default CustomerNotification;
