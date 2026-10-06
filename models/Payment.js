const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 150,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    paymentMethod: {
      type: String,
      enum: ['online', 'cash'],
      required: true,
      default: 'online',
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    // Online gateway fields
    orderId: {
      type: String,
      sparse: true,
      default: null,
    },
    paymentId: {
      type: String,
      sparse: true,
      default: null,
    },
    signature: {
      type: String,
      default: null,
    },
    razorpayOrderId: {
      type: String,
      sparse: true,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    paymentDate: {
      type: Date,
      default: null,
    },
    // Cash payment verification fields
    cashPaymentDate: {
      type: Date,
      default: null,
    },
    cashVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    cashVerificationNote: {
      type: String,
      default: '',
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
