import mongoose from 'mongoose';

const termsAcceptanceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
  },
  userType: {
    type: String,
    enum: ['Customer', 'Driver', 'Customer/Driver'],
    default: 'Customer/Driver'
  },
  termsVersion: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: 'Accepted'
  },
  acceptedAt: {
    type: Date,
    default: Date.now
  }
});

const TermsAcceptance = mongoose.model('TermsAcceptance', termsAcceptanceSchema);
export default TermsAcceptance;
