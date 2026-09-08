import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  fullName: {
    type: String,
    trim: true
  },
  PhoneNumber: {
    type: String,
    trim: true
  },
  countryCode: {
    type: String,
    default: '+92'
  },
  Email: {
    type: String,
    trim: true,
    lowercase: true
  },
  CustomerPhoto: {
    url: String,
    public_id: String
  },
  profilePicture: {
    url: String
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  strict: false,
  collection: 'customers'
});

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema, 'customers');

export default Customer;
