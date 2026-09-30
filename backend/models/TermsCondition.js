import mongoose from 'mongoose';

const termsConditionSchema = new mongoose.Schema({
  version: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Draft', 'Published'],
    default: 'Draft',
  },
  publishedAt: {
    type: Date,
  },
}, { timestamps: true });

const TermsCondition = mongoose.model('TermsCondition', termsConditionSchema);
export default TermsCondition;
