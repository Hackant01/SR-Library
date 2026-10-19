const Seat = require('../models/Seat');
const Booking = require('../models/Booking');

/**
 * Initializes the physical 43-seat hall arrangement for SR Library according to the official seating layout diagram.
 *
 * Hall Architecture:
 * - Exactly 43 physical study seats.
 * - Left Wall: Seats 43 down to 31 (13 seats).
 * - Central Aisle / Walkway.
 * - Right Hall Blocks:
 *   - Block 1 (Top): Row 1 [4, 3, 2, 1], Row 2 [5, 6, 7, 8] (8 seats)
 *   - Block 2 (Mid): Row 3 [12, 11, 10, 9], Row 4 [13, 14, 15, 16] (8 seats)
 *   - Entrance / Door on right side of walkway
 *   - Block 3 (Opposite Door): Row 5 [19, 18, 17], Row 6 [20, 21, 22] (6 seats)
 *   - Block 4 (Bottom): Row 7 [26, 25, 24, 23], Row 8 [27, 28, 29, 30] (8 seats)
 *
 * Locked / Unavailable seats: 13, 14, 15, 17, 19.
 * Seats 22, 24, 34 are available.
 */

const LOCKED_SEAT_NUMBERS = ['13', '14', '15', '17', '19'];

const getSeatMetadata = (num) => {
  const n = parseInt(num, 10);
  let section = 'Main Study Hall';
  let block = 'Block 1';
  let row = 'Row 1';

  if (n >= 31 && n <= 43) {
    section = 'Left Wall Section';
    block = 'Left Wall';
    row = `Desk ${n}`;
  } else if (n >= 1 && n <= 8) {
    section = 'Block 1 (Front Hall)';
    block = 'Block 1';
    row = n <= 4 ? 'Row 1' : 'Row 2';
  } else if (n >= 9 && n <= 16) {
    section = 'Block 2 (Mid Hall - Near Door)';
    block = 'Block 2';
    row = n <= 12 ? 'Row 3' : 'Row 4';
  } else if (n >= 17 && n <= 22) {
    section = 'Block 3 (Opposite Door)';
    block = 'Block 3';
    row = n <= 19 ? 'Row 5' : 'Row 6';
  } else if (n >= 23 && n <= 30) {
    section = 'Block 4 (Back Hall)';
    block = 'Block 4';
    row = n <= 26 ? 'Row 7' : 'Row 8';
  }

  return { section, block, row };
};

const initSeats = async () => {
  try {
    const existingSeats = await Seat.find();

    // Check if seats already match the 43 numbered format
    const hasOldFormat = existingSeats.some((s) => s.seatNumber.startsWith('A-') || s.seatNumber.startsWith('B-'));
    const is43Configured = existingSeats.length === 43 && !hasOldFormat;

    if (is43Configured) {
      // Ensure the designated locked seats (13, 14, 15, 17, 19) have locked status unless already locked
      for (const lockedNum of LOCKED_SEAT_NUMBERS) {
        const s = await Seat.findOne({ seatNumber: lockedNum });
        if (s && s.status !== 'locked' && s.status !== 'occupied') {
          s.status = 'locked';
          await s.save();
        }
      }
      return;
    }

    console.log('🔄 Initializing / Migrating SR Library to the exact 43-seat physical layout...');

    // Preserve any existing active bookings by remapping A-01 -> 1, A-02 -> 2, etc.
    const activeBookings = await Booking.find({ status: 'active' });
    const bookingMap = new Map();

    for (const b of activeBookings) {
      let mappedNum = b.seatNumber;
      if (b.seatNumber.startsWith('A-') || b.seatNumber.startsWith('B-')) {
        const rawNum = parseInt(b.seatNumber.replace(/^[AB]-/, ''), 10);
        mappedNum = String(Math.min(Math.max(rawNum, 1), 43));
        b.seatNumber = mappedNum;
        await b.save();
      }
      bookingMap.set(mappedNum, b);
    }

    // Clear old seat records
    await Seat.deleteMany({});

    const newSeats = [];
    for (let i = 1; i <= 43; i++) {
      const seatNumStr = String(i);
      const meta = getSeatMetadata(i);
      const isPermanentlyLocked = LOCKED_SEAT_NUMBERS.includes(seatNumStr);
      const activeBookingForSeat = bookingMap.get(seatNumStr);

      let status = 'available';
      let currentBooking = null;
      let currentStudent = null;

      if (isPermanentlyLocked) {
        status = 'locked';
      } else if (activeBookingForSeat) {
        status = 'occupied';
        currentBooking = activeBookingForSeat._id;
        currentStudent = activeBookingForSeat.student;
      }

      newSeats.push({
        seatNumber: seatNumStr,
        section: meta.section,
        row: meta.row,
        type: i >= 31 ? 'window_desk' : 'standard',
        status,
        currentBooking,
        currentStudent,
        features: ['Ergonomic Chair', 'Power Socket', 'Reading Light', 'WiFi 6'],
        pricePerMonth: 1000,
      });
    }

    const insertedSeats = await Seat.insertMany(newSeats);

    // Update active booking seat references to the new Seat ObjectIds
    for (const seat of insertedSeats) {
      if (seat.currentBooking) {
        await Booking.findByIdAndUpdate(seat.currentBooking, { seat: seat._id });
      }
    }

    console.log(`✅ Successfully initialized exact 43 physical study seats for SR Library!`);
    console.log(`🔒 Permanently locked seats: ${LOCKED_SEAT_NUMBERS.join(', ')}`);
  } catch (err) {
    console.warn('⚠️ Seat initialization note:', err.message);
  }
};

module.exports = initSeats;
