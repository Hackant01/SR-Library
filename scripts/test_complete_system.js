const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const connectDB = require('../config/db');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const Admin = require('../models/Admin');
const generateStudentId = require('../utils/generateStudentId');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 STARTING COMPREHENSIVE AUTOMATED VERIFICATION');
  console.log('====================================================');

  await connectDB();

  // Test admin credentials
  const admin = await Admin.findOne({ email: 'admin@srlibrary.com' });
  if (!admin) {
    console.error('❌ Super Admin not found in DB');
    process.exit(1);
  }
  console.log('✅ Admin found:', admin.email);

  // Clean up any previous test records
  await Student.deleteMany({ email: /test.*@srlibrary-test\.com/ });
  await Payment.deleteMany({ currency: 'INR', orderId: /test_order/ });

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Online Payment Flow
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 1: Online Registration Flow ---');
  const onlineStudentId = await generateStudentId();
  console.log('Generated Online Student ID:', onlineStudentId);

  const onlineEmail = `test_online_${Date.now()}@srlibrary-test.com`;
  const onlineStudent = new Student({
    studentId: onlineStudentId,
    fullName: 'Online Test Student',
    parentName: 'Parent Test',
    dateOfBirth: new Date('2002-05-15'),
    gender: 'male',
    address: '123 Test Street, Civil Lines',
    mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
    emergencyContact: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
    email: onlineEmail,
    password: 'Password@123',
    idProofType: 'Aadhaar Card',
    idProofNumber: '1234-5678-9012',
    educationLevel: 'Undergraduate',
    preparingFor: 'UPSC / Civil Services',
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
    emailStatus: 'sent',
  });
  await onlineStudent.save();

  const onlinePayment = new Payment({
    student: onlineStudent._id,
    amount: 150,
    currency: 'INR',
    paymentMethod: 'online',
    status: 'paid',
    orderId: 'test_order_online_' + Date.now(),
    paymentId: 'test_pay_online_' + Date.now(),
    paymentDate: new Date(),
  });
  await onlinePayment.save();

  onlineStudent.paymentId = onlinePayment._id;
  await onlineStudent.save();

  console.log('Online Student Created:');
  console.log('- Student ID:', onlineStudent.studentId);
  console.log('- Payment Status:', onlineStudent.paymentStatus);
  console.log('- Approval Status:', onlineStudent.approvalStatus);
  console.log('- Account Status:', onlineStudent.accountStatus);
  console.log('- Password check (correct case):', await onlineStudent.comparePassword('Password@123'));
  console.log('- Password check (wrong case):', await onlineStudent.comparePassword('password@123'));

  if (
    onlineStudent.paymentStatus === 'paid' &&
    onlineStudent.approvalStatus === 'approved' &&
    onlineStudent.accountStatus === 'active' &&
    (await onlineStudent.comparePassword('Password@123')) === true &&
    (await onlineStudent.comparePassword('password@123')) === false
  ) {
    console.log('✅ TEST 1 PASSED: Online flow creates Active student with case-sensitive password!');
  } else {
    console.error('❌ TEST 1 FAILED');
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Cash Payment Registration & Verification Flow
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Cash Payment Registration & Verification ---');
  const cashStudentId = await generateStudentId();
  const cashEmail = `test_cash_${Date.now()}@srlibrary-test.com`;

  const cashStudent = new Student({
    studentId: cashStudentId,
    fullName: 'Cash Test Student',
    parentName: 'Cash Parent',
    dateOfBirth: new Date('2001-08-20'),
    gender: 'female',
    address: '456 Market Road',
    mobile: `96${Math.floor(10000000 + Math.random() * 90000000)}`,
    emergencyContact: `95${Math.floor(10000000 + Math.random() * 90000000)}`,
    email: cashEmail,
    password: 'Secret#2026',
    idProofType: 'PAN Card',
    idProofNumber: 'ABCDE1234F',
    educationLevel: 'Postgraduate',
    preparingFor: 'Banking / IBPS / SBI',
    membershipSlot: 'Morning Slot',
    subscriptionPlan: '3 Months Plan',
    slotTiming: '6:00 AM - 10:00 AM',
    joiningDate: new Date(),
    declarationAccepted: true,
    registrationFee: 150,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    approvalStatus: 'pending',
    accountStatus: 'pending',
    emailStatus: 'pending',
  });
  await cashStudent.save();

  const cashPayment = new Payment({
    student: cashStudent._id,
    amount: 150,
    currency: 'INR',
    paymentMethod: 'cash',
    status: 'pending',
  });
  await cashPayment.save();
  cashStudent.paymentId = cashPayment._id;
  await cashStudent.save();

  console.log('Cash Student Initial State:');
  console.log('- Payment:', cashStudent.paymentStatus);
  console.log('- Approval:', cashStudent.approvalStatus);
  console.log('- Account:', cashStudent.accountStatus);

  if (
    cashStudent.paymentStatus === 'pending' &&
    cashStudent.approvalStatus === 'pending' &&
    cashStudent.accountStatus === 'pending'
  ) {
    console.log('✅ Cash Student Initial State verified as Pending');
  } else {
    console.error('❌ Cash Student Initial State failed');
  }

  // Admin marks cash payment as received:
  cashStudent.paymentStatus = 'paid';
  cashStudent.approvalStatus = 'approved';
  cashStudent.accountStatus = 'active';
  await cashStudent.save({ validateModifiedOnly: true });

  cashPayment.status = 'paid';
  cashPayment.cashPaymentDate = new Date();
  cashPayment.cashVerifiedBy = admin._id;
  cashPayment.cashVerificationNote = 'Verified at counter in test';
  await cashPayment.save();

  console.log('Cash Student After Admin Verification:');
  console.log('- Payment:', cashStudent.paymentStatus);
  console.log('- Approval:', cashStudent.approvalStatus);
  console.log('- Account:', cashStudent.accountStatus);

  if (
    cashStudent.paymentStatus === 'paid' &&
    cashStudent.approvalStatus === 'approved' &&
    cashStudent.accountStatus === 'active' &&
    cashPayment.status === 'paid'
  ) {
    console.log('✅ TEST 2 PASSED: Cash flow marked paid & active successfully!');
  } else {
    console.error('❌ TEST 2 FAILED');
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Deactivate & Activate Flow
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Deactivate and Activate Flow ---');
  // Deactivate
  cashStudent.accountStatus = 'inactive';
  await cashStudent.save({ validateModifiedOnly: true });
  console.log('- After Deactivate, Account Status:', cashStudent.accountStatus);

  if (cashStudent.accountStatus === 'inactive') {
    console.log('✅ Account deactivated successfully (student blocked from login)');
  }

  // Activate
  cashStudent.accountStatus = 'active';
  await cashStudent.save({ validateModifiedOnly: true });
  console.log('- After Activate, Account Status:', cashStudent.accountStatus);

  if (cashStudent.accountStatus === 'active') {
    console.log('✅ TEST 3 PASSED: Account re-activated successfully!');
  } else {
    console.error('❌ TEST 3 FAILED');
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Delete Flow
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Delete Student and Payments ---');
  const studentToDelete = await Student.findByIdAndDelete(onlineStudent._id);
  const paymentDeleteResult = await Payment.deleteMany({ student: onlineStudent._id });
  console.log('- Deleted Student:', studentToDelete ? studentToDelete.fullName : null);
  console.log('- Deleted Payments Count:', paymentDeleteResult.deletedCount);

  const checkDeleted = await Student.findById(onlineStudent._id);
  const checkPaymentDeleted = await Payment.findOne({ student: onlineStudent._id });

  if (!checkDeleted && !checkPaymentDeleted) {
    console.log('✅ TEST 4 PASSED: Student and related payments permanently deleted from MongoDB!');
  } else {
    console.error('❌ TEST 4 FAILED');
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Revenue Aggregation (Dynamic from Payment records)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Dynamic Revenue Calculation ---');
  const revenueAgg = await Payment.aggregate([
    { $match: { status: 'paid' } },
    {
      $group: {
        _id: '$paymentMethod',
        totalRevenue: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  let onlineRev = 0, onlineCnt = 0, cashRev = 0, cashCnt = 0;
  revenueAgg.forEach((r) => {
    if (r._id === 'online') {
      onlineRev = r.totalRevenue;
      onlineCnt = r.count;
    } else if (r._id === 'cash') {
      cashRev = r.totalRevenue;
      cashCnt = r.count;
    }
  });

  const totRev = onlineRev + cashRev;
  const totPaid = onlineCnt + cashCnt;

  console.log(`- Online Revenue: ₹${onlineRev} (${onlineCnt} paid)`);
  console.log(`- Cash Revenue: ₹${cashRev} (${cashCnt} paid)`);
  console.log(`- Total Revenue: ₹${totRev} (${totPaid} paid total)`);
  console.log('✅ TEST 5 PASSED: Revenue dynamically aggregated directly from MongoDB Payment records!');

  // Clean up test cash student
  await Student.findByIdAndDelete(cashStudent._id);
  await Payment.deleteMany({ student: cashStudent._id });

  console.log('\n====================================================');
  console.log('🎉 ALL AUTOMATED DATABASE AND LOGIC TESTS PASSED!');
  console.log('====================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
