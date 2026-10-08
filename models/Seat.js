const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema(
  {
    seatNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    section: {
      type: String,
      required: true,
      default: 'Section A',
      trim: true,
    },
    row: {
      type: String,
      default: 'A',
      trim: true,
    },
    type: {
      type: String,
      enum: ['standard', 'reserved_cabin', 'window_desk'],
      default: 'standard',
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'maintenance'],
      default: 'available',
    },
    currentBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    currentStudent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    features: {
      type: [String],
      default: ['Power Socket', 'Reading Light', 'Ergonomic Chair'],
    },
    pricePerMonth: {
      type: Number,
      default: 1000,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Seat', seatSchema);
