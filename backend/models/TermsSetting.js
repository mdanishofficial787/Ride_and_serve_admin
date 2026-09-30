import mongoose from 'mongoose';

const termsSettingSchema = new mongoose.Schema({
  showDuringSignup: {
    type: Boolean,
    default: true,
  },
  agreementRequired: {
    type: Boolean,
    default: true,
  },
  checkboxLabel: {
    type: String,
    default: "I agree to the Terms & Conditions and Privacy Policy",
  }
}, { timestamps: true });

const TermsSetting = mongoose.model('TermsSetting', termsSettingSchema);
export default TermsSetting;
