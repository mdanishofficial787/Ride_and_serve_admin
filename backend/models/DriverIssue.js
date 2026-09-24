import mongoose from 'mongoose';

const driverIssueSchema = new mongoose.Schema({
  issueId: {
    type: String,
    required: true,
    unique: true
  },
  driverId: {
    type: String,
    default: null
  },
  driverName: {
    type: String,
    required: true
  },
  driverPhone: {
    type: String,
    default: ''
  },
  driverCode: {
    type: String,
    default: ''
  },
  vehicle: {
    type: String,
    default: 'Sedan Executive'
  },
  reason: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: 'Islamabad'
  },
  rideId: {
    type: String,
    default: ''
  },
  requestId: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'Under Review', 'Replacement Dispatched', 'Resolved'],
    default: 'Pending'
  },
  severity: {
    type: String,
    enum: ['Low', 'Normal', 'Medium', 'High', 'Critical'],
    default: 'High'
  },
  replacementDriverId: {
    type: String,
    default: null
  },
  replacementDriverName: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

const DriverIssueModel = mongoose.models.DriverIssue || mongoose.model('DriverIssue', driverIssueSchema, 'driverissues');

export default DriverIssueModel;
