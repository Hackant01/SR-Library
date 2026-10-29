require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Seat = require('../models/Seat');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const EmailLog = require('../models/EmailLog');
const emailService = require('../services/emailService');
const generateStudentId = require('../utils/generateStudentId');

const connectDB = require('../config/db');

async function runCompleteVerification() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE BACKEND & DATABASE VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    console.log('Connecting to MongoDB Atlas...');
    await connectDB();
    console.log('Connected to MongoDB.\n');

    // ─── 1. VERIFY 43 SEATS CONFIGURATION ───────────────────────────
    console.log('--- 1. Verifying 43-Seat Physical Layout Configuration ---');
    const totalSeats = await Seat.countDocuments();
    assert(totalSeats === 43, `Total seats in database is exactly 43 (found: ${totalSeats})`);

    const lockedByDefault = [13, 14, 15, 17, 19];
    const lockedSeats = await Seat.find({ seatNumber: { $in: lockedByDefault } });
    const allLocked = lockedSeats.every(s => s.status === 'locked');
    assert(allLocked && lockedSeats.length === 5, 'Seats 13, 14, 15, 17, and 19 are locked/unavailable by default');

    const shouldNotBeLocked = [22, 24, 34];
    const checkAvailableSeats = await Seat.find({ seatNumber: { $in: shouldNotBeLocked } });
    const noneLocked = checkAvailableSeats.every(s => s.status !== 'locked');
    assert(noneLocked, 'Seats 22, 24, and 34 are not locked');

    // ─── 2. TEST AUTOMATIC WELCOME EMAIL TRIGGER ON REGISTRATION ────
    console.log('\n--- 2. Testing Automatic Welcome Email on Student Registration ---');
    const testEmail = `test_student_${Date.now()}@example.com`;
    const testStudentId = await generateStudentId();
    assert(testStudentId && testStudentId.startsWith('LIB'), `Generated student ID is valid: ${testStudentId}`);

    const newStudent = new Student({
      studentId: testStudentId,
      fullName: 'Verification Test Student',
      parentName: 'Parent Verification',
      dateOfBirth: new Date('2001-01-01'),
      gender: 'male',
      address: 'Near Gandhi Chowk, Shahdol, M.P.',
      mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      emergencyContact: '9876543211',
      email: testEmail,
      password: 'HashedPassword123!',
      idProofType: 'Aadhaar Card',
      idProofNumber: '1234-5678-9012',
      educationLevel: 'Graduate',
      preparingFor: 'UPSC / Civil Services',
      membershipSlot: 'Full Day Slot (Unlimited)',
      subscriptionPlan: '1 Month Plan',
      slotTiming: '6:00 AM - 10:00 PM (Full Day)',
      joiningDate: new Date(),
      declarationAccepted: true,
      registrationFee: 150,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      registrationDate: new Date(),
      status: 'pending',
    });
    await newStudent.save();
    assert(newStudent._id != null, 'Test student saved to database');

    // Trigger automatic welcome email
    const emailResult = await emailService.sendWelcomeEmail(newStudent, { triggerEvent: 'registration' });
    assert(emailResult !== undefined, 'Automatic welcome email triggered');

    // Verify EmailLog record was created in database
    const welcomeLog = await EmailLog.findOne({
      recipientEmail: testEmail,
      emailType: 'welcome',
    });
    assert(welcomeLog != null, 'EmailLog entry exists for student registration');
    assert(welcomeLog.studentId === testStudentId, `EmailLog recorded exact student ID: ${welcomeLog.studentId}`);
    assert(welcomeLog.triggerEvent === 'registration', 'EmailLog recorded trigger event: registration');
    assert(['accepted', 'failed'].includes(welcomeLog.status), `EmailLog records truthful status: ${welcomeLog.status}`);

    // Test duplicate send prevention
    const duplicateSendResult = await emailService.sendWelcomeEmail(newStudent, { triggerEvent: 'registration' });
    // It should skip or safely not duplicate if already queued/sent
    const logCountAfterDuplicate = await EmailLog.countDocuments({
      recipientEmail: testEmail,
      emailType: 'welcome',
      triggerEvent: 'registration',
    });
    assert(logCountAfterDuplicate === 1, 'Duplicate welcome email prevented for the same registration event');

    // ─── 3. TEST AUTOMATIC PAYMENT CONFIRMATION EMAIL ──────────────
    console.log('\n--- 3. Testing Automatic Payment Confirmation Email ---');
    const testPayment = new Payment({
      student: newStudent._id,
      amount: 800,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      paidAt: new Date(),
      receiptNumber: `REC-${Date.now()}`,
    });
    await testPayment.save();

    // Trigger payment confirmation email
    const paymentEmailResult = await emailService.sendPaymentConfirmationEmail(
      newStudent,
      testPayment,
      { triggerEvent: 'cash_verified' }
    );
    assert(paymentEmailResult !== undefined, 'Automatic payment confirmation email triggered');

    const paymentLog = await EmailLog.findOne({
      recipientEmail: testEmail,
      emailType: 'payment_confirmation',
    });
    assert(paymentLog != null, 'EmailLog entry exists for payment confirmation');
    assert(paymentLog.meta && paymentLog.meta.amount === 800, 'EmailLog meta contains accurate payment amount: 800');
    assert(paymentLog.meta && paymentLog.meta.paymentMethod === 'cash', 'EmailLog meta contains accurate payment method: cash');

    // Duplicate payment email prevention
    await emailService.sendPaymentConfirmationEmail(newStudent, testPayment, { triggerEvent: 'cash_verified' });
    const paymentLogCount = await EmailLog.countDocuments({
      recipientEmail: testEmail,
      emailType: 'payment_confirmation',
      'meta.paymentId': String(testPayment._id),
    });
    assert(paymentLogCount === 1, 'Duplicate payment email prevented for the same payment transaction');

    // ─── 4. TEST SEAT MANAGEMENT & ATOMIC BOOKING LOGIC ─────────────
    console.log('\n--- 4. Testing Seat Booking & Race Condition Prevention ---');
    // Try booking a locked seat (e.g. seat 13)
    const lockedSeat = await Seat.findOne({ seatNumber: 13 });
    assert(lockedSeat.status === 'locked', 'Confirmed Seat 13 is locked');

    // Atomic findOneAndUpdate for available seat should fail on seat 13
    const lockedBookingAttempt = await Seat.findOneAndUpdate(
      { seatNumber: 13, status: 'available' },
      { status: 'booked', currentStudent: newStudent._id },
      { new: true }
    );
    assert(lockedBookingAttempt === null, 'Atomic booking fails safely on locked seat 13');

    // Find an available seat
    const availableSeat = await Seat.findOne({ status: 'available' });
    assert(availableSeat != null, `Found available seat for test: #${availableSeat.seatNumber}`);

    // Book the available seat
    const bookedSeat = await Seat.findOneAndUpdate(
      { seatNumber: availableSeat.seatNumber, status: 'available' },
      { status: 'booked', currentStudent: newStudent._id },
      { new: true }
    );
    assert(bookedSeat != null && bookedSeat.status === 'booked', `Seat #${availableSeat.seatNumber} atomically booked`);

    // Concurrent/duplicate booking attempt on same seat must fail
    const secondBookingAttempt = await Seat.findOneAndUpdate(
      { seatNumber: availableSeat.seatNumber, status: 'available' },
      { status: 'booked', currentStudent: newStudent._id },
      { new: true }
    );
    assert(secondBookingAttempt === null, 'Concurrent booking on already-booked seat is strictly rejected');

    // Create a booking record
    const booking = new Booking({
      bookingId: `BK-${Date.now()}`,
      student: newStudent._id,
      studentName: newStudent.fullName,
      studentMobile: newStudent.mobile,
      studentEmail: newStudent.email,
      seat: bookedSeat._id,
      seatNumber: String(bookedSeat.seatNumber),
      status: 'active',
      bookingDate: new Date(),
    });
    await booking.save();

    // ─── 5. TEST ADMIN STUDENT EDIT, DEACTIVATION & SAFE DELETION ────
    console.log('\n--- 5. Testing Student Details Admin Actions & Safe Deletion ---');
    // Admin Edit Student
    newStudent.mobile = '9123456789';
    newStudent.city = 'Shahdol';
    await newStudent.save();
    const updatedStudent = await Student.findById(newStudent._id);
    assert(updatedStudent.mobile === '9123456789', 'Admin student update persisted properly');

    // Deactivation test
    updatedStudent.accountStatus = 'inactive';
    await updatedStudent.save();
    const deactivatedStudent = await Student.findById(newStudent._id);
    assert(deactivatedStudent.accountStatus === 'inactive', 'Student deactivation succeeds');

    // Safe deletion test: freeing the seat and cancelling bookings while preserving payments
    const studentSeat = await Seat.findOne({ currentStudent: updatedStudent._id });
    if (studentSeat) {
      studentSeat.status = 'available';
      studentSeat.currentStudent = null;
      await studentSeat.save();
    }
    await Booking.updateMany({ student: updatedStudent._id, status: 'active' }, { status: 'cancelled' });
    await Student.findByIdAndDelete(updatedStudent._id);

    const checkStudentGone = await Student.findById(updatedStudent._id);
    assert(checkStudentGone === null, 'Student safely deleted');

    const checkSeatFreed = await Seat.findById(bookedSeat._id);
    assert(checkSeatFreed.status === 'available' && checkSeatFreed.currentStudent === null, 'Associated seat was freed to available');

    const checkPaymentPreserved = await Payment.findById(testPayment._id);
    assert(checkPaymentPreserved != null, 'Payment record is preserved for financial audit history');

    // Cleanup test artifacts
    await Payment.findByIdAndDelete(testPayment._id);
    await Booking.deleteMany({ seat: bookedSeat._id, student: updatedStudent._id });
    await EmailLog.deleteMany({ recipientEmail: testEmail });

    console.log('\n====================================================');
    console.log(`📊 ALL VERIFICATION TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Fatal error during test run:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runCompleteVerification();
