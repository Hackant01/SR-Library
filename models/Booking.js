const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    studentMobile: {
      type: String,
      required: true,
    },
    studentEmail: {
      type: String,
      required: true,
    },
    seat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seat',
      required: true,
    },
    seatNumber: {
      type: String,
      required: true,
    },
    bookingDate: {
      type: Date,
      default: Date.now,
    },
    slot: {
      type: String,
      default: 'Full Day (6:00 AM - 11:00 PM)',
    },
    plan: {
      type: String,
      default: 'Monthly Membership',
    },
    duration: {
      type: String,
      default: '1 Month',
    },
    amount: {
      type: Number,
      default: 1000,
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'included_in_membership'],
      default: 'included_in_membership',
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
