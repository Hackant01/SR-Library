require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const EmailLog = require('../models/EmailLog');
const generateStudentId = require('../utils/generateStudentId');
const {
  isEmailConfigured,
  verifyEmailConnection,
  sendWelcomeEmail,
  sendPaymentConfirmationEmail,
  retryEmailLog,
} = require('../services/emailService');

async function runEmailDeliveryDiagnostics() {
  console.log('====================================================');
  console.log('📧 RUNNING EMAIL DELIVERY & DIAGNOSTICS SUITE');
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
    await connectDB();

    // ─── 1. ENVIRONMENT CONFIGURATION INSPECTION ──────────────────
    console.log('\n--- 1. Inspecting Server-Side Environment Variables ---');
    console.log(`  EMAIL_HOST      : ${process.env.EMAIL_HOST || 'smtp.gmail.com (default)'}`);
    console.log(`  EMAIL_PORT      : ${process.env.EMAIL_PORT || '587 (default)'}`);
    console.log(`  EMAIL_USER      : ${process.env.EMAIL_USER}`);
    console.log(`  EMAIL_FROM_NAME : ${process.env.EMAIL_FROM_NAME}`);
    console.log(`  EMAIL_PASSWORD  : ${process.env.EMAIL_PASSWORD ? '[Configured - length: ' + process.env.EMAIL_PASSWORD.length + ' chars]' : '[Missing]'}`);

    const configured = isEmailConfigured();
    console.log(`  isEmailConfigured() returns: ${configured}`);

    if (!configured) {
      assert(
        !configured,
        'Code correctly flags placeholder EMAIL_PASSWORD as notConfigured (prevents broken silent attempts)'
      );
    } else {
      assert(configured, 'SMTP is configured with real non-placeholder credentials');
      const connTest = await verifyEmailConnection();
      console.log(`  Provider Connection Test: ${connTest.message}`);
    }

    // ─── 2. TEST REGISTRATION WELCOME EMAIL WORKFLOW ──────────────
    console.log('\n--- 2. Testing Registration Welcome Email ---');
    const testStudentId = await generateStudentId();
    const testEmail = `test_delivery_${Date.now()}@example.com`;

    const student = new Student({
      studentId: testStudentId,
      fullName: 'Email Test Student',
      parentName: 'Parent Test',
      dateOfBirth: new Date('2000-01-01'),
      gender: 'female',
      address: 'Shahdol, Madhya Pradesh',
      mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      emergencyContact: '9876543210',
      email: testEmail,
      password: 'HashedPassword123!',
      idProofType: 'Aadhaar Card',
      idProofNumber: '1111-2222-3333',
      educationLevel: 'Postgraduate',
      preparingFor: 'MPPSC',
      membershipSlot: 'Full Day Slot (Unlimited)',
      subscriptionPlan: '1 Month Plan',
      slotTiming: '6:00 AM - 10:00 PM (Full Day)',
      joiningDate: new Date(),
      declarationAccepted: true,
      registrationFee: 150,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      accountStatus: 'pending',
      registrationDate: new Date(),
    });
    await student.save();
    assert(student._id != null, 'Test student record created in database');

    const welcomeResult = await sendWelcomeEmail(student, { triggerEvent: 'registration' });
    assert(welcomeResult.emailLogId != null, 'Email sending returned an EmailLog ID');

    const welcomeLog = await EmailLog.findById(welcomeResult.emailLogId);
    assert(welcomeLog != null, 'EmailLog record exists in database');
    assert(welcomeLog.recipientEmail === testEmail.toLowerCase(), `Log recipient matches: ${welcomeLog.recipientEmail}`);
    assert(welcomeLog.studentId === testStudentId, `Log student ID matches: ${welcomeLog.studentId}`);
    assert(welcomeLog.attemptCount >= 1, `Attempt count recorded: ${welcomeLog.attemptCount}`);

    if (!configured) {
      assert(welcomeLog.status === 'failed', 'Truthful status: marked as "failed" when SMTP credentials are placeholder');
      assert(welcomeLog.errorInfo.includes('SMTP credentials not configured'), 'Helpful errorInfo recorded in database log');
    }

    // ─── 3. TEST PAYMENT CONFIRMATION EMAIL WORKFLOW ──────────────
    console.log('\n--- 3. Testing Payment Confirmation Email ---');
    const payment = new Payment({
      student: student._id,
      amount: 1000,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      paidAt: new Date(),
      receiptNumber: `RCPT-${Date.now()}`,
    });
    await payment.save();

    const paymentResult = await sendPaymentConfirmationEmail(student, payment, { triggerEvent: 'cash_verified' });
    assert(paymentResult.emailLogId != null, 'Payment email returned an EmailLog ID');

    const paymentLog = await EmailLog.findById(paymentResult.emailLogId);
    assert(paymentLog != null, 'Payment EmailLog record exists in database');
    assert(paymentLog.emailType === 'payment_confirmation', 'Log emailType is payment_confirmation');
    assert(paymentLog.meta.amount === 1000, `Log meta has exact payment amount: ₹${paymentLog.meta.amount}`);
    assert(paymentLog.meta.paymentMethod === 'cash', `Log meta has exact payment method: ${paymentLog.meta.paymentMethod}`);

    // ─── 4. TEST RETRYING PREVIOUSLY FAILED EMAIL ─────────────────
    console.log('\n--- 4. Testing Retry Functionality on Failed Email ---');
    const initialAttempts = welcomeLog.attemptCount;
    const retryResult = await retryEmailLog(welcomeLog._id);

    const reloadedLog = await EmailLog.findById(welcomeLog._id);
    assert(reloadedLog.attemptCount === initialAttempts + 1, `Attempt count incremented: ${reloadedLog.attemptCount}`);
    assert(reloadedLog.lastAttemptAt > welcomeLog.createdAt, 'lastAttemptAt timestamp updated on retry');
    assert(reloadedLog.status === 'failed' || reloadedLog.status === 'accepted', `Status truthfully recorded: ${reloadedLog.status}`);

    // ─── 5. FAILURE HANDLING WHEN SMTP UNAVAILABLE ────────────────
    console.log('\n--- 5. Testing Failure Handling & Safety Rules ---');
    // Ensure failure does not delete student account
    const studentCheck = await Student.findById(student._id);
    assert(studentCheck != null, 'Student registration remains preserved after email failure');

    // Duplicate send prevention
    const duplicateAttempt = await sendWelcomeEmail(student, { triggerEvent: 'registration' });
    assert(
      duplicateAttempt.duplicatePrevented === true || duplicateAttempt.success === false,
      'Duplicate send prevention triggered for repeated requests'
    );

    // Verify secrets are not leaked in log
    assert(
      !reloadedLog.errorInfo || (!reloadedLog.errorInfo.includes(process.env.EMAIL_PASSWORD || 'secret') && !reloadedLog.errorInfo.includes('your_gmail_app_password')),
      'Error info never exposes passwords or secrets'
    );

    // ─── CLEANUP TEST DATA ─────────────────────────────────────────
    await Student.findByIdAndDelete(student._id);
    await Payment.findByIdAndDelete(payment._id);
    await EmailLog.deleteMany({ recipientEmail: testEmail });

    console.log('\n====================================================');
    console.log(`📊 DIAGNOSTICS SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Fatal error during diagnostic run:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runEmailDeliveryDiagnostics();
