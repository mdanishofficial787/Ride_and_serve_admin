import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  assignmentId: {
    type: String,
    unique: true,
    index: true
  },
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Request',
    required: [true, 'Request ID is required'],
    index: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: [true, 'Driver ID is required'],
    index: true
  },
  status: {
    type: String,
    enum: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'ASSIGNED',
    index: true
  },
  dispatchedAt: {
    type: Date,
    default: Date.now
  },
  remarks: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

assignmentSchema.pre('save', async function (next) {
  if (!this.assignmentId) {
    try {
      const lastDoc = await mongoose.model('Assignment').findOne().sort({ createdAt: -1 });
      let nextNum = 5001;
      if (lastDoc && lastDoc.assignmentId) {
        const match = String(lastDoc.assignmentId).match(/ASG-(\d+)/);
        if (match) nextNum = Math.max(nextNum, parseInt(match[1], 10) + 1);
      }
      const count = await mongoose.model('Assignment').countDocuments();
      nextNum = Math.max(nextNum, 5000 + count + 1);
      while (await mongoose.model('Assignment').exists({ assignmentId: `ASG-${nextNum}` })) {
        nextNum++;
      }
      this.assignmentId = `ASG-${nextNum}`;
    } catch (e) {
      this.assignmentId = `ASG-${Date.now().toString().slice(-6)}`;
    }
  }
  next();
});

const Assignment = mongoose.model('Assignment', assignmentSchema);

export default Assignment;
