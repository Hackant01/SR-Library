require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');
const EmailLog = require('../models/EmailLog');
const generateStudentId = require('../utils/generateStudentId');
const { sendWelcomeEmail, verifyEmailConnection } = require('../services/emailService');

async function testSmtpFailureHandling() {
  console.log('====================================================');
  console.log('🧪 TESTING SMTP PROVIDER FAILURE HANDLING');
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

  // Temporarily set an invalid app password to trigger actual Gmail SMTP authentication rejection
  process.env.EMAIL_USER = 'srselfstudyzone@gmail.com';
  process.env.EMAIL_PASSWORD = 'invalid_dummy_app_password_for_testing';

  try {
    await connectDB();

    console.log('1. Testing verifyEmailConnection with simulated invalid password...');
    const connCheck = await verifyEmailConnection();
    assert(connCheck.configured === true, 'Service recognizes credentials as configured');
    assert(connCheck.verified === false, 'Service correctly identifies that provider rejected the invalid authentication');
    assert(connCheck.message.includes('SMTP connection failed'), 'Helpful sanitized connection error reported');
    assert(!connCheck.message.includes('invalid_dummy_app_password_for_testing'), 'Connection error does not leak password string');

    console.log('\n2. Testing registration email with rejected SMTP...');
    const testEmail = `test_reject_${Date.now()}@example.com`;
    const testStudentId = await generateStudentId();

    const student = new Student({
      studentId: testStudentId,
      fullName: 'Rejected SMTP Student',
      parentName: 'Parent Test',
      dateOfBirth: new Date('2000-01-01'),
      gender: 'male',
      address: 'Shahdol, Madhya Pradesh',
      mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      emergencyContact: '9876543210',
      email: testEmail,
      password: 'HashedPassword123!',
      idProofType: 'Aadhaar Card',
      idProofNumber: '1111-2222-3333',
      educationLevel: 'Graduate',
      preparingFor: 'UPSC',
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

    const result = await sendWelcomeEmail(student, { triggerEvent: 'registration' });
    assert(result.success === false, 'Send result truthfully returns success: false');
    assert(result.emailLogId != null, 'EmailLog ID still created and returned');

    const logged = await EmailLog.findById(result.emailLogId);
    assert(logged != null, 'Failed email is saved in EmailLog for admin visibility');
    assert(logged.status === 'failed', 'EmailLog status marked truthfully as "failed"');
    assert(logged.errorInfo != null && logged.errorInfo.length > 0, `ErrorInfo captured: ${logged.errorInfo.substring(0, 50)}...`);
    assert(!logged.errorInfo.includes('invalid_dummy_app_password_for_testing'), 'ErrorInfo does NOT leak the password');

    // Student must still be intact
    const studentCheck = await Student.findById(student._id);
    assert(studentCheck != null, 'Student account remains safely registered and saved in database');

    // Cleanup
    await Student.findByIdAndDelete(student._id);
    await EmailLog.deleteMany({ recipientEmail: testEmail });

    console.log('\n====================================================');
    console.log(`📊 SMTP FAILURE HANDLING TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Error during SMTP failure test:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

testSmtpFailureHandling();
