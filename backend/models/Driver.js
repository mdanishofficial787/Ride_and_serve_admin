import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema({
  // New API fields
  driverReferenceId: { type: String, unique: true, index: true },
  Name: { type: String, required: [true, 'Driver name is required'], trim: true },
  PhoneNumber: { type: String, required: [true, 'Phone number is required'], trim: true },
  CountryCode: { type: String, default: '+92' },
  CountryIso: { type: String, default: 'PK' },
  Email: { type: String, trim: true, lowercase: true },
  CnicNumber: { type: String },
  License: { type: String },
  LicenseExpiryDate: { type: Date },
  
  driverPhoto: { url: String, public_id: String },
  CnicFront: { url: String, public_id: String },
  CnicBack: { url: String, public_id: String },
  LicenseFront: { url: String, public_id: String },
  LicenseBack: { url: String, public_id: String },
  VehicleCardFront: { url: String, public_id: String },
  VehicleCardBack: { url: String, public_id: String },
  VehicleFront: { url: String, public_id: String },
  vehicleImages: {
    frontView: { url: String, public_id: String },
    backView: { url: String, public_id: String }
  },

  verificationStatus: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected'],
    default: 'Pending',
    index: true
  },
  registrationComplete: { type: Boolean, default: true },

  // Old fields for backward compatibility (Optional, but kept to prevent breaking existing routes)
  driverId: { type: String },
  name: { type: String },
  email: { type: String },
  phone: { type: String },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  rating: { type: Number, default: 4.8 },
  availability: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      scheduleType: 'same',
      specificDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      slots: [
        {
          id: '1',
          timeText: '9:00 AM - 5:00 PM',
          isFlexible: false,
          isActive: true
        }
      ]
    })
  },
  liveStatus: { type: String, enum: ['Available', 'On Trip', 'Offline'], default: 'Available' },
  city: { type: String, default: 'Islamabad' },
  vehicleDetails: {
    make: { type: String, default: 'Toyota' },
    model: { type: String, default: 'Corolla' }
  }
}, {
  timestamps: true,
  strict: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

driverSchema.pre('validate', async function (next) {
  // Auto-generate reference IDs if missing
  if (!this.driverReferenceId) {
    const count = await mongoose.model('Driver').countDocuments();
    this.driverReferenceId = `DRV-${1000 + count + 1}`;
  }
  if (!this.driverId) this.driverId = this.driverReferenceId;
  
  // Sync fields
  if (this.Name && !this.name) this.name = this.Name;
  if (!this.Name && this.name) this.Name = this.name;
  if (this.PhoneNumber && !this.phone) this.phone = this.PhoneNumber;
  if (!this.PhoneNumber && this.phone) this.PhoneNumber = this.phone;
  if (this.Email && !this.email) this.email = this.Email;
  if (!this.Email && this.email) this.Email = this.email;
  
  if (this.verificationStatus === 'Verified') this.status = 'APPROVED';
  if (this.verificationStatus === 'Rejected') this.status = 'REJECTED';
  if (this.status === 'APPROVED') this.verificationStatus = 'Verified';
  if (this.status === 'REJECTED') this.verificationStatus = 'Rejected';

  next();
});

const Driver = mongoose.model('Driver', driverSchema);

export default Driver;
