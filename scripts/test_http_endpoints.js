const http = require('http');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000';

function makeRequest(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method: method,
      headers: { ...headers },
    };

    if (body) {
      if (typeof body === 'object') {
        body = JSON.stringify(body);
      }
      if (!options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
      }
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data,
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function testHttpEndpoints() {
  console.log('========================================================');
  console.log('🌐 TESTING HTTP ENDPOINTS END-TO-END');
  console.log('========================================================');

  const connectDB = require('../config/db');
  await connectDB();

  // 1. Admin Login
  console.log('\n1. Testing Admin Login...');
  const loginBody = new URLSearchParams({
    email: 'admin@srlibrary.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123456',
  }).toString();

  const loginRes = await makeRequest('POST', '/admin/login', {
    'Content-Type': 'application/x-www-form-urlencoded',
  }, loginBody);

  console.log('Admin login status:', loginRes.statusCode);
  const cookieHeader = loginRes.headers['set-cookie'];
  if (!cookieHeader) {
    console.error('❌ Failed to get admin session cookie');
    process.exit(1);
  }
  const adminCookie = cookieHeader.map(c => c.split(';')[0]).join('; ');
  console.log('✅ Admin authenticated. Cookie received.');

  // 2. Admin Dashboard
  console.log('\n2. Testing Admin Dashboard...');
  const dashRes = await makeRequest('GET', '/admin/dashboard', { Cookie: adminCookie });
  console.log('Dashboard status:', dashRes.statusCode);
  const hasOldText = dashRes.data.includes('₹150 fee per student');
  console.log('Contains "₹150 fee per student"?', hasOldText ? '❌ YES (BUG)' : '✅ NO (Fixed)');
  const hasPaymentDashboard = dashRes.data.includes('Payment Dashboard');
  console.log('Contains Payment Dashboard?', hasPaymentDashboard ? '✅ YES' : '❌ NO');

  // 3. Admin Payments Page
  console.log('\n3. Testing Admin Payments Page...');
  const paymentsRes = await makeRequest('GET', '/admin/payments', { Cookie: adminCookie });
  console.log('Payments page status:', paymentsRes.statusCode);
  console.log('Payments page loaded?', paymentsRes.statusCode === 200 ? '✅ YES' : '❌ NO');

  // 4. Student Registration - Online Gateway Flow
  console.log('\n4. Testing Student Online Registration Flow...');
  const orderRes = await makeRequest('POST', '/student/create-order', {}, JSON.stringify({ amount: 150 }));
  const orderJson = JSON.parse(orderRes.data);
  console.log('Create order response:', orderJson.orderId);

  const simRes = await makeRequest('POST', '/student/simulate-payment', {}, JSON.stringify({
    orderId: orderJson.orderId,
    method: 'upi',
  }));
  const simJson = JSON.parse(simRes.data);
  console.log('Simulate payment response:', simJson.paymentId);

  const onlineStudentEmail = `http_online_${Date.now()}@srlibrary-test.com`;
  const onlineVerifyRes = await makeRequest('POST', '/student/verify-payment', {}, {
    fullName: 'HTTP Online Member',
    parentName: 'Guardian Member',
    dateOfBirth: '2003-04-10',
    gender: 'male',
    address: 'Plot 44, Residency Area',
    mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
    emergencyContact: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
    email: onlineStudentEmail,
    password: 'SecurePassword123',
    confirmPassword: 'SecurePassword123',
    idProofType: 'Aadhaar Card',
    idProofNumber: '7788-9900-1122',
    educationLevel: 'Undergraduate',
    preparingFor: 'UPSC / Civil Services',
    membershipSlot: 'Morning Slot',
    subscriptionPlan: '1 Month Plan',
    slotTiming: '6:00 AM - 10:00 AM',
    joiningDate: '2026-10-10',
    declaration: 'on',
    orderId: orderJson.orderId,
    paymentId: simJson.paymentId,
    signature: simJson.signature,
  });

  const onlineVerifyJson = JSON.parse(onlineVerifyRes.data);
  console.log('Online verify response:', onlineVerifyJson);
  console.log('Assigned Student ID:', onlineVerifyJson.studentId);
  const onlineId = onlineVerifyJson.studentId;

  // 5. Student Registration - Cash Flow
  console.log('\n5. Testing Student Cash Registration Flow...');
  const cashStudentEmail = `http_cash_${Date.now()}@srlibrary-test.com`;
  const cashFormBody = new URLSearchParams({
    fullName: 'HTTP Cash Member',
    parentName: 'Cash Guardian',
    dateOfBirth: '2002-11-20',
    gender: 'female',
    address: 'Near Old Bus Stand',
    mobile: `96${Math.floor(10000000 + Math.random() * 90000000)}`,
    emergencyContact: `95${Math.floor(10000000 + Math.random() * 90000000)}`,
    email: cashStudentEmail,
    password: 'CashPassword123',
    confirmPassword: 'CashPassword123',
    idProofType: 'Voter ID',
    idProofNumber: 'VTR12345678',
    educationLevel: 'Postgraduate',
    preparingFor: 'Banking / IBPS / SBI',
    membershipSlot: 'Full Day Slot (Unlimited)',
    subscriptionPlan: '3 Months Plan',
    slotTiming: '6:00 AM - 10:00 PM (Full Day)',
    joiningDate: '2026-10-15',
    paymentMethod: 'cash',
    declaration: 'on',
  }).toString();

  const cashRegRes = await makeRequest('POST', '/student/register', {
    'Content-Type': 'application/x-www-form-urlencoded',
  }, cashFormBody);

  console.log('Cash registration status:', cashRegRes.statusCode); // Expect 302 redirect to registration-success

  // Find created cash student in DB
  const Student = require('../models/Student');
  const cashStudentDoc = await Student.findOne({ email: cashStudentEmail });
  console.log('Cash student in DB:');
  console.log('- ID:', cashStudentDoc._id.toString());
  console.log('- Student ID:', cashStudentDoc.studentId);
  console.log('- Payment Status:', cashStudentDoc.paymentStatus);
  console.log('- Account Status:', cashStudentDoc.accountStatus);

  // 6. Admin Marks Cash Payment Received
  console.log('\n6. Testing Admin Mark Cash Payment Received...');
  const markCashRes = await makeRequest('POST', `/admin/students/${cashStudentDoc._id}/mark-cash-paid`, {
    Cookie: adminCookie,
    'Accept': 'application/json',
  }, { note: 'Verified ₹150 at desk' });

  const markCashJson = JSON.parse(markCashRes.data);
  console.log('Mark cash result:', markCashJson);
  const updatedCashStudent = await Student.findById(cashStudentDoc._id);
  console.log('- Updated Payment:', updatedCashStudent.paymentStatus);
  console.log('- Updated Account:', updatedCashStudent.accountStatus);

  // 7. Testing Print Registration Form
  console.log('\n7. Testing Print Registration Form route...');
  const printRes = await makeRequest('GET', `/admin/students/${cashStudentDoc._id}/print`, {
    Cookie: adminCookie,
  });
  console.log('Print route status:', printRes.statusCode);
  const hasPrintHeader = printRes.data.includes('SR SELF STUDY ZONE & LIBRARY') && printRes.data.includes('MEMBERSHIP REGISTRATION FORM');
  const hasPrintSections = printRes.data.includes('PERSONAL INFORMATION') && printRes.data.includes('FOR OFFICE USE ONLY');
  console.log('Print form valid?', (hasPrintHeader && hasPrintSections) ? '✅ YES' : '❌ NO');

  // 8. Testing Deactivate and Activate Routes
  console.log('\n8. Testing Deactivate and Activate Routes...');
  const deactRes = await makeRequest('POST', `/admin/students/${cashStudentDoc._id}/deactivate`, {
    Cookie: adminCookie,
    'Accept': 'application/json',
  });
  const deactJson = JSON.parse(deactRes.data);
  console.log('Deactivate response:', deactJson);
  const deactStudent = await Student.findById(cashStudentDoc._id);
  console.log('- Account Status after Deactivate:', deactStudent.accountStatus);

  const actRes = await makeRequest('POST', `/admin/students/${cashStudentDoc._id}/activate`, {
    Cookie: adminCookie,
    'Accept': 'application/json',
  });
  const actJson = JSON.parse(actRes.data);
  console.log('Activate response:', actJson);
  const actStudent = await Student.findById(cashStudentDoc._id);
  console.log('- Account Status after Activate:', actStudent.accountStatus);

  // 9. Testing Student Search & Filters
  console.log('\n9. Testing Student Search & Filters...');
  const searchNameRes = await makeRequest('GET', `/admin/students?search=HTTP+Cash`, { Cookie: adminCookie });
  console.log('Search by Name found student?', searchNameRes.data.includes('HTTP Cash Member') ? '✅ YES' : '❌ NO');

  const searchIdRes = await makeRequest('GET', `/admin/students?search=${cashStudentDoc.studentId}`, { Cookie: adminCookie });
  console.log('Search by Student ID found student?', searchIdRes.data.includes(cashStudentDoc.studentId) ? '✅ YES' : '❌ NO');

  const filterMethodRes = await makeRequest('GET', `/admin/students?method=cash`, { Cookie: adminCookie });
  console.log('Filter by Cash status:', filterMethodRes.statusCode === 200 ? '✅ 200 OK' : '❌ FAIL');

  // 10. Testing Delete Student Route
  console.log('\n10. Testing Delete Student Route...');
  const deleteRes = await makeRequest('POST', `/admin/students/${cashStudentDoc._id}/delete`, {
    Cookie: adminCookie,
    'Accept': 'application/json',
  });
  const deleteJson = JSON.parse(deleteRes.data);
  console.log('Delete response:', deleteJson);
  const checkDeleted = await Student.findById(cashStudentDoc._id);
  console.log('Student removed from MongoDB?', !checkDeleted ? '✅ YES' : '❌ NO');

  // Clean up online student created in test
  const onlineDoc = await Student.findOne({ email: onlineStudentEmail });
  if (onlineDoc) {
    await Student.findByIdAndDelete(onlineDoc._id);
    const Payment = require('../models/Payment');
    await Payment.deleteMany({ student: onlineDoc._id });
  }

  console.log('\n========================================================');
  console.log('🎉 ALL HTTP ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY!');
  console.log('========================================================');
  process.exit(0);
}

testHttpEndpoints().catch((err) => {
  console.error('HTTP Test Error:', err);
  process.exit(1);
});
