require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const EmailLog = require('../models/EmailLog');
const emailService = require('../services/emailService');
const generateStudentId = require('../utils/generateStudentId');
const connectDB = require('../config/db');

async function testAllEmailFlows() {
  console.log('====================================================');
  console.log('📧 STARTING REAL SMTP EMAIL FLOW VERIFICATION');
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
    console.log('Database connected.\n');

    // 0. Verify SMTP credentials & connection
    console.log('--- 0. Verifying SMTP Connectivity & Settings ---');
    assert(emailService.isEmailConfigured() === true, 'isEmailConfigured() returns true');
    const verifyResult = await emailService.verifyEmailConnection();
    console.log('SMTP Verify Result:', verifyResult);
    assert(verifyResult.verified === true, 'verifyEmailConnection() succeeded with Gmail SMTP (STARTTLS port 587)');

    // 1. Send direct test email
    console.log('\n--- 1. Sending Direct Test Email to Controller Address ---');
    const targetEmail = process.env.EMAIL_USER || 'srselfstudyzone@gmail.com';
    const testResult = await emailService.sendTestEmail(targetEmail);
    console.log('Direct test email result:', testResult);
    assert(testResult.success === true, `Test email accepted by Gmail for ${targetEmail}`);
    assert(Boolean(testResult.messageId), `Test email Message-ID received: ${testResult.messageId}`);

    // 2. Test Automatic Student Registration Welcome Email
    console.log('\n--- 2. Testing Automatic Welcome Email on Student Registration ---');
    const testStudentId = await generateStudentId();
    const testStudent = new Student({
      studentId: testStudentId,
      fullName: 'SR Live Test Student',
      parentName: 'Test Guardian',
      dateOfBirth: new Date('2000-01-01'),
      gender: 'male',
      address: 'Near Gandhi Chowk, Shahdol, M.P.',
      mobile: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
      emergencyContact: '9876543210',
      email: targetEmail,
      password: 'HashedPassword123!',
      idProofType: 'Aadhaar Card',
      idProofNumber: '1234-5678-9099',
      educationLevel: 'Graduate',
      preparingFor: 'MPPSC / Civil Services',
      membershipSlot: 'Full Day Slot (Unlimited)',
      subscriptionPlan: '1 Month Plan',
      slotTiming: '6:00 AM - 10:00 PM (Full Day)',
      joiningDate: new Date(),
      declarationAccepted: true,
      registrationFee: 150,
      paymentMethod: 'online',
      paymentStatus: 'paid',
      approvalStatus: 'approved',
      accountStatus: 'active',
      emailStatus: 'pending',
    });
    await testStudent.save();
    console.log(`Created test student with ID: ${testStudent.studentId}`);

    const welcomeResult = await emailService.sendWelcomeEmail(testStudent, { triggerEvent: 'registration', forceResend: true });
    console.log('Welcome email send result:', welcomeResult);
    assert(welcomeResult.success === true, 'Welcome email accepted by Gmail SMTP');
    assert(Boolean(welcomeResult.messageId), `Welcome email Message-ID: ${welcomeResult.messageId}`);

    // Verify EmailLog in MongoDB
    const welcomeLog = await EmailLog.findById(welcomeResult.emailLogId);
    assert(welcomeLog != null, 'EmailLog record exists for welcome email');
    assert(welcomeLog.status === 'accepted', `EmailLog status marked accepted (actual: ${welcomeLog.status})`);
    assert(welcomeLog.recipientEmail === targetEmail.toLowerCase(), 'EmailLog recipient matches target');

    // 3. Test Automatic Payment Confirmation Email
    console.log('\n--- 3. Testing Automatic Payment Confirmation Email ---');
    const testPayment = new Payment({
      student: testStudent._id,
      amount: 150,
      currency: 'INR',
      paymentMethod: 'online',
      status: 'paid',
      orderId: `ORDER_${Date.now()}`,
      paymentId: `PAY_${Date.now()}`,
      signature: 'test_signature_hex',
      paymentDate: new Date(),
    });
    await testPayment.save();

    const paymentResult = await emailService.sendPaymentConfirmationEmail(testStudent, testPayment, { triggerEvent: 'online_payment', forceResend: true });
    console.log('Payment confirmation email send result:', paymentResult);
    assert(paymentResult.success === true, 'Payment confirmation email accepted by Gmail SMTP');
    assert(Boolean(paymentResult.messageId), `Payment confirmation Message-ID: ${paymentResult.messageId}`);

    const paymentLog = await EmailLog.findById(paymentResult.emailLogId);
    assert(paymentLog != null, 'EmailLog record exists for payment confirmation');
    assert(paymentLog.status === 'accepted', `EmailLog status marked accepted (actual: ${paymentLog.status})`);
    assert(paymentLog.meta && paymentLog.meta.amount === 150, 'EmailLog recorded correct amount: ₹150');

    // 4. Test Retrying Failed Email Records
    console.log('\n--- 4. Testing Failed Email Log Retry Flow ---');
    // Create a synthetic failed EmailLog entry
    const failedLog = new EmailLog({
      student: testStudent._id,
      studentId: testStudent.studentId,
      recipientEmail: targetEmail,
      recipientName: testStudent.fullName,
      emailType: 'welcome',
      triggerEvent: 'registration',
      subject: `Welcome to SR Library | Your Student ID (Simulated Retry Test)`,
      status: 'failed',
      attemptCount: 1,
      lastAttemptAt: new Date(Date.now() - 3600000),
      errorInfo: 'Simulated network timeout during initial attempt',
    });
    await failedLog.save();
    console.log(`Created failed EmailLog record with ID: ${failedLog._id}`);

    // Perform retry via retryEmailLog
    const retryResult = await emailService.retryEmailLog(failedLog._id);
    console.log('Retry result:', retryResult);
    assert(retryResult.success === true, 'retryEmailLog returned success: true');

    // Check reloaded failedLog
    const reloadedLog = await EmailLog.findById(failedLog._id);
    console.log('Reloaded EmailLog after retry:', {
      status: reloadedLog.status,
      attemptCount: reloadedLog.attemptCount,
      errorInfo: reloadedLog.errorInfo,
      messageId: reloadedLog.messageId,
    });
    assert(reloadedLog.status === 'accepted', `EmailLog status transitioned from 'failed' to 'accepted'`);
    assert(reloadedLog.attemptCount === 2, `attemptCount incremented to 2 (actual: ${reloadedLog.attemptCount})`);
    assert(reloadedLog.errorInfo === null, 'errorInfo cleared after successful retry');
    assert(Boolean(reloadedLog.messageId), `Updated with new valid Message-ID: ${reloadedLog.messageId}`);

    // Cleanup test artifacts
    await Payment.deleteOne({ _id: testPayment._id });
    await Student.deleteOne({ _id: testStudent._id });
    await EmailLog.deleteMany({ _id: { $in: [welcomeLog._id, paymentLog._id, failedLog._id] } });
    console.log('\nCleaned up temporary test documents.');

    console.log('\n====================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

testAllEmailFlows();
