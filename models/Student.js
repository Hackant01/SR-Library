const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    parentName: {
      type: String,
      required: [true, "Father's/Mother's name is required"],
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required'],
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    address: {
      type: String,
      required: [true, 'Residential address is required'],
      trim: true,
    },
    emergencyContact: {
      type: String,
      required: [true, 'Emergency contact number is required'],
      trim: true,
    },
    idProofType: {
      type: String,
      required: [true, 'ID Proof type is required'],
      trim: true,
    },
    idProofNumber: {
      type: String,
      required: [true, 'ID Proof number is required'],
      trim: true,
    },
    educationLevel: {
      type: String,
      required: [true, 'Education level is required'],
      trim: true,
    },
    preparingFor: {
      type: String,
      required: [true, 'Preparing for is required'],
      trim: true,
    },
    membershipSlot: {
      type: String,
      required: [true, 'Membership slot is required'],
      trim: true,
    },
    subscriptionPlan: {
      type: String,
      required: [true, 'Subscription plan is required'],
      trim: true,
    },
    slotTiming: {
      type: String,
      required: [true, 'Slot timing is required'],
      trim: true,
    },
    declarationAccepted: {
      type: Boolean,
      default: true,
    },
    // Legacy optional fields for backward compatibility with existing records
    city: {
      type: String,
      trim: true,
      default: '',
    },
    state: {
      type: String,
      trim: true,
      default: '',
    },
    pincode: {
      type: String,
      trim: true,
      default: '',
    },
    college: {
      type: String,
      trim: true,
      default: '',
    },
    course: {
      type: String,
      trim: true,
      default: '',
    },
    semester: {
      type: String,
      trim: true,
      default: '',
    },
    joiningDate: {
      type: Date,
      required: [true, 'Joining date is required'],
    },
    registrationDate: {
      type: Date,
      default: Date.now,
    },
    profilePhoto: {
      type: String,
      default: null,
    },
    registrationFee: {
      type: Number,
      default: 150,
    },
    paymentMethod: {
      type: String,
      enum: ['online', 'cash'],
      default: 'online',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    accountStatus: {
      type: String,
      enum: ['pending', 'active', 'inactive', 'rejected'],
      default: 'pending',
    },
    emailStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
  },
  { timestamps: true }
);

// Hash password before saving
studentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
studentSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
studentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Student', studentSchema);
