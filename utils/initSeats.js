const Seat = require('../models/Seat');

/**
 * Initializes physical seats for SR Library if none exist.
 * SR Library has 40+ dedicated study seats across Section A (Quiet Hall) and Section B (Private Cabins).
 */
const initSeats = async () => {
  try {
    const count = await Seat.countDocuments();
    if (count > 0) return;

    console.log('🌱 Seeding initial library study seats (40 seats)...');
    const seats = [];

    // Section A: Main Quiet Study Hall (A-01 to A-20)
    for (let i = 1; i <= 20; i++) {
      const num = i < 10 ? `0${i}` : `${i}`;
      seats.push({
        seatNumber: `A-${num}`,
        section: 'Section A - Main Quiet Hall',
        row: i <= 10 ? 'A1' : 'A2',
        type: i % 4 === 0 ? 'window_desk' : 'standard',
        status: i === 3 || i === 7 ? 'occupied' : i === 19 ? 'maintenance' : 'available',
        features: ['Ergonomic Chair', 'Power Socket', 'LED Desk Lamp', 'WiFi 6'],
        pricePerMonth: 1000,
      });
    }

    // Section B: Dedicated Reserved Cabins (B-01 to B-20)
    for (let i = 1; i <= 20; i++) {
      const num = i < 10 ? `0${i}` : `${i}`;
      seats.push({
        seatNumber: `B-${num}`,
        section: 'Section B - Reserved Cabins',
        row: i <= 10 ? 'B1' : 'B2',
        type: 'reserved_cabin',
        status: i === 5 || i === 12 ? 'occupied' : 'available',
        features: ['Private Partition', 'Locker Included', 'Power Socket', 'Ergonomic Chair'],
        pricePerMonth: 1100,
      });
    }

    await Seat.insertMany(seats);
    console.log('✅ Initialized 40 study seats for SR Library');
  } catch (err) {
    console.warn('⚠️ Seat initialization note:', err.message);
  }
};

module.exports = initSeats;
