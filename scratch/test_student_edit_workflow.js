require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');
const Booking = require('../models/Booking');
const Seat = require('../models/Seat');
const generateStudentId = require('../utils/generateStudentId');
const http = require('http');

function postJson(urlPath, data, cookie) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (_) {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getJson(urlPath, cookie) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (_) {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function loginAdmin() {
  return new Promise((resolve, reject) => {
    const loginPayload = 'email=admin%40srlibrary.com&password=Admin%40123456';
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginPayload),
      },
    }, (res) => {
      const setCookie = res.headers['set-cookie'];
      let cookie = '';
      if (setCookie) {
        cookie = setCookie.map(c => c.split(';')[0]).join('; ');
      }
      resolve({ statusCode: res.statusCode, cookie });
    });
    req.on('error', reject);
    req.write(loginPayload);
    req.end();
  });
}

async function testEditStudentWorkflow() {
  console.log('====================================================');
  console.log('🧪 TESTING COMPLETE EDIT STUDENT WORKFLOW');
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

    // 1. Admin Authentication
    console.log('--- 1. Authenticating Admin ---');
    const loginRes = await loginAdmin();
    assert(loginRes.statusCode === 302 && loginRes.cookie.includes('adminToken='), 'Admin successfully logged in and received token cookie');
    const adminCookie = loginRes.cookie;

    // 2. Create Two Test Students (one to edit, one to test duplicate collisions)
    console.log('\n--- 2. Setting Up Test Student Records ---');
    const studentId1 = await generateStudentId();
    const email1 = `test_edit_${Date.now()}@example.com`;
    const mobile1 = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

    const student1 = new Student({
      studentId: studentId1,
      fullName: 'Original Student Name',
      parentName: 'Original Parent Name',
      dateOfBirth: new Date('2001-05-10'),
      gender: 'male',
      address: 'Original Address, Civil Lines, Shahdol',
      mobile: mobile1,
      emergencyContact: '9876543210',
      email: email1,
      password: 'HashedPassword123!',
      idProofType: 'Aadhaar Card',
      idProofNumber: '1234-5678-9012',
      educationLevel: 'Undergraduate',
      preparingFor: 'UPSC',
      membershipSlot: 'Full Day Slot (Unlimited)',
      subscriptionPlan: '1 Month Plan',
      slotTiming: '6:00 AM - 10:00 PM (Full Day)',
      joiningDate: new Date('2026-01-01'),
      declarationAccepted: true,
      registrationFee: 150,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      approvalStatus: 'approved',
      accountStatus: 'active',
      registrationDate: new Date(),
    });
    await student1.save();
    assert(student1._id != null, `Test student 1 created (${student1.fullName}, ${student1.studentId})`);

    const studentId2 = await generateStudentId();
    const email2 = `existing_other_${Date.now()}@example.com`;
    const mobile2 = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    const student2 = new Student({
      studentId: studentId2,
      fullName: 'Another Existing Student',
      parentName: 'Parent Other',
      dateOfBirth: new Date('2000-02-02'),
      gender: 'female',
      address: 'Shahdol',
      mobile: mobile2,
      emergencyContact: '9876543211',
      email: email2,
      password: 'HashedPassword123!',
      idProofType: 'PAN Card',
      idProofNumber: 'ABCDE1234F',
      educationLevel: 'Graduate',
      preparingFor: 'Banking',
      membershipSlot: 'Morning Shift (6:00 AM - 2:00 PM)',
      subscriptionPlan: '1 Month Plan',
      slotTiming: '6:00 AM - 2:00 PM',
      joiningDate: new Date('2026-01-01'),
      declarationAccepted: true,
      registrationFee: 150,
      paymentMethod: 'online',
      paymentStatus: 'paid',
      approvalStatus: 'approved',
      accountStatus: 'active',
    });
    await student2.save();
    assert(student2._id != null, `Test student 2 created for collision testing`);

    // Create a mock active booking for student1 to test booking sync
    const booking = new Booking({
      bookingId: `BK-TEST-${Date.now()}`,
      student: student1._id,
      studentName: student1.fullName,
      studentMobile: student1.mobile,
      studentEmail: student1.email,
      seat: new mongoose.Types.ObjectId(),
      seatNumber: '42',
      status: 'active',
    });
    await booking.save();
    assert(booking._id != null, 'Active booking record created for student 1');

    // 3. Test Loading Student Information (GET /admin/api/students/:id)
    console.log('\n--- 3. Testing GET /admin/api/students/:id (Load Modal Data) ---');
    const getRes = await getJson(`/admin/api/students/${student1._id}`, adminCookie);
    assert(getRes.statusCode === 200, 'GET /admin/api/students/:id returns HTTP 200');
    assert(getRes.data.success === true, 'Response reports success: true');
    assert(getRes.data.student.fullName === 'Original Student Name', 'Correct student name loaded');
    assert(getRes.data.student.studentId === studentId1, 'Correct Student ID loaded');
    assert(getRes.data.student.password === undefined, 'Student password is excluded from JSON API response');

    // 4. Test Validation: Invalid Mobile Number (<10 digits)
    console.log('\n--- 4. Testing Validation: Invalid Mobile Number ---');
    const badMobileRes = await postJson(`/admin/students/${student1._id}/edit`, {
      fullName: 'New Name',
      parentName: 'New Parent',
      mobile: '12345',
      email: email1,
    }, adminCookie);
    assert(badMobileRes.statusCode === 400, 'Invalid mobile length rejected with HTTP 400');
    assert(badMobileRes.data.message.includes('10 digits'), 'Clear error message: Mobile number must be exactly 10 digits');

    // 5. Test Validation: Invalid Email Address
    console.log('\n--- 5. Testing Validation: Invalid Email Address ---');
    const badEmailRes = await postJson(`/admin/students/${student1._id}/edit`, {
      fullName: 'New Name',
      parentName: 'New Parent',
      mobile: mobile1,
      email: 'not-an-email',
    }, adminCookie);
    assert(badEmailRes.statusCode === 400, 'Invalid email format rejected with HTTP 400');
    assert(badEmailRes.data.message.includes('valid email address'), 'Clear error message: Please provide a valid email address');

    // 6. Test Duplicate Collisions: Existing Email of Another Student
    console.log('\n--- 6. Testing Duplicate Constraint: Collision with Another Email ---');
    const dupEmailRes = await postJson(`/admin/students/${student1._id}/edit`, {
      fullName: 'New Name',
      parentName: 'New Parent',
      mobile: mobile1,
      email: email2, // student 2's email
    }, adminCookie);
    assert(dupEmailRes.statusCode === 400, 'Duplicate email collision rejected with HTTP 400');
    assert(dupEmailRes.data.message.includes('already in use'), 'Clear error message indicating email is already in use');

    // 7. Test Duplicate Collisions: Existing Mobile of Another Student
    console.log('\n--- 7. Testing Duplicate Constraint: Collision with Another Mobile ---');
    const dupMobileRes = await postJson(`/admin/students/${student1._id}/edit`, {
      fullName: 'New Name',
      parentName: 'New Parent',
      mobile: mobile2, // student 2's mobile
      email: email1,
    }, adminCookie);
    assert(dupMobileRes.statusCode === 400, 'Duplicate mobile collision rejected with HTTP 400');
    assert(dupMobileRes.data.message.includes('already in use'), 'Clear error message indicating mobile is already in use');

    // 8. Test Successful Edit & Persistence
    console.log('\n--- 8. Testing Successful Student Details Update & Persistence ---');
    const newName = 'Aarav Sharma (Updated)';
    const newMobile = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
    const newParent = 'Rajesh Sharma';
    const newAddress = 'Plot 45, Rajendra Nagar, Shahdol';
    const newPrep = 'MPPSC State Services';

    const editRes = await postJson(`/admin/students/${student1._id}/edit`, {
      fullName: newName,
      parentName: newParent,
      mobile: newMobile,
      email: email1,
      address: newAddress,
      preparingFor: newPrep,
      gender: 'male',
      idProofType: 'Aadhaar Card',
      membershipSlot: 'Full Day Slot (Unlimited)',
      subscriptionPlan: '3 Months Plan',
      // Intentionally pass attempts to tamper with protected fields:
      studentId: 'HACKED_ID',
      paymentStatus: 'pending',
      approvalStatus: 'rejected',
      accountStatus: 'inactive',
    }, adminCookie);

    assert(editRes.statusCode === 200, 'Valid update returns HTTP 200');
    assert(editRes.data.success === true, 'Response reports success: true');
    assert(editRes.data.message.includes('updated successfully'), 'Success message returned');

    // 9. Verify Direct Database Persistence
    console.log('\n--- 9. Verifying Direct Database State ---');
    const freshStudent = await Student.findById(student1._id);
    assert(freshStudent.fullName === newName, `Full name persisted: "${freshStudent.fullName}"`);
    assert(freshStudent.mobile === newMobile, `Mobile persisted: "${freshStudent.mobile}"`);
    assert(freshStudent.parentName === newParent, `Parent name persisted: "${freshStudent.parentName}"`);
    assert(freshStudent.address === newAddress, `Address persisted: "${freshStudent.address}"`);
    assert(freshStudent.preparingFor === newPrep, `PreparingFor persisted: "${freshStudent.preparingFor}"`);

    // 10. Verify Protected Fields Were NOT Tampered With
    console.log('\n--- 10. Verifying Strict Protection of System Fields ---');
    assert(freshStudent.studentId === studentId1, `Student ID remained unchanged: "${freshStudent.studentId}" (was NOT overwritten)`);
    assert(freshStudent.paymentStatus === 'paid', `Payment status remained: "${freshStudent.paymentStatus}" (was NOT overwritten)`);
    assert(freshStudent.approvalStatus === 'approved', `Approval status remained: "${freshStudent.approvalStatus}" (was NOT overwritten)`);
    assert(freshStudent.accountStatus === 'active', `Account status remained: "${freshStudent.accountStatus}" (was NOT overwritten)`);

    // 11. Verify Booking Record Sync
    console.log('\n--- 11. Verifying Dependent Booking Record Sync ---');
    const freshBooking = await Booking.findById(booking._id);
    assert(freshBooking.studentName === newName, `Booking studentName synchronized: "${freshBooking.studentName}"`);
    assert(freshBooking.studentMobile === newMobile, `Booking studentMobile synchronized: "${freshBooking.studentMobile}"`);

    // 12. Cleanup
    await Student.findByIdAndDelete(student1._id);
    await Student.findByIdAndDelete(student2._id);
    await Booking.findByIdAndDelete(booking._id);

    console.log('\n====================================================');
    console.log(`📊 EDIT STUDENT WORKFLOW SUITE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Fatal error during edit student test:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

testEditStudentWorkflow();
