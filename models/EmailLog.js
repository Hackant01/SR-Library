const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    studentId: {
      type: String,
      trim: true,
      default: '',
    },
    recipientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    recipientName: {
      type: String,
      trim: true,
      default: '',
    },
    emailType: {
      type: String,
      enum: ['welcome', 'payment_confirmation', 'rejection', 'custom'],
      required: true,
    },
    triggerEvent: {
      type: String,
      enum: ['registration', 'online_payment', 'cash_verified', 'admin_resend', 'admin_manual', 'retry'],
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sending', 'accepted', 'failed'],
      default: 'queued',
    },
    attemptCount: {
      type: Number,
      default: 1,
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now,
    },
    errorInfo: {
      type: String,
      default: null,
    },
    messageId: {
      type: String,
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

emailLogSchema.index({ recipientEmail: 1, emailType: 1 });
emailLogSchema.index({ studentId: 1 });
emailLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
