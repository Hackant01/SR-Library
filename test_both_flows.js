const http = require('http');

function postJson(urlPath, data, cookie = '') {
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
      const setCookie = res.headers['set-cookie'];
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            setCookie: setCookie ? setCookie.map((c) => c.split(';')[0]).join('; ') : '',
            data: body.startsWith('{') ? JSON.parse(body) : body,
          });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function postForm(urlPath, formObj, cookie = '') {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams(formObj).toString();
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(params),
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          setCookie: setCookie ? setCookie.map((c) => c.split(';')[0]).join('; ') : '',
          data: body,
        });
      });
    });

    req.on('error', reject);
    req.write(params);
    req.end();
  });
}

function getReq(urlPath, cookie = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: 'GET',
      headers: {
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: body,
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('==================================================');
  console.log('🧪 STARTING E2E AUTOMATED TESTS FOR BOTH FLOWS');
  console.log('==================================================\n');

  const ts = Date.now().toString().slice(-6);

  // ----------------------------------------------------
  // TEST 1: ONLINE PAYMENT FLOW
  // ----------------------------------------------------
  console.log('--------------------------------------------------');
  console.log('▶️ TEST 1: ONLINE PAYMENT FLOW (₹150)');
  console.log('--------------------------------------------------');

  const onlineStudent = {
    fullName: `Online Tester ${ts}`,
    parentName: 'Parent Sharma',
    dateOfBirth: '2002-05-15',
    gender: 'male',
    mobile: `98${ts.padStart(8, '1')}`.slice(0, 10),
    email: `online_${ts}@test.com`,
    password: 'Password@123',
    confirmPassword: 'Password@123',
    address: '101 Cyber Heights',
    city: 'Patna',
    state: 'Bihar',
    pincode: '800001',
    college: 'IIT Patna',
    course: 'B.Tech CS',
    semester: '6th Semester',
    joiningDate: '2026-04-01',
    paymentMethod: 'online',
  };

  // Step 1: Create Order
  console.log('1. Student creates payment order on server...');
  const orderRes = await postJson('/student/create-order', {});
  console.log('   Response:', orderRes.data);
  if (!orderRes.data.orderId || orderRes.data.amount !== 150) {
    throw new Error('Create order failed or amount is not 150');
  }

  // Step 2: Gateway Simulation
  console.log('2. Gateway processes payment of ₹150 and generates HMAC signature...');
  const simRes = await postJson('/student/simulate-payment', {
    orderId: orderRes.data.orderId,
    method: 'upi',
  });
  console.log('   Gateway Signature generated:', simRes.data.signature.substring(0, 20) + '...');

  // Step 3: Backend Verification & Auto-Approval
  console.log('3. Submitting to backend for cryptographic signature verification...');
  const verifyRes = await postJson('/student/verify-payment', {
    ...onlineStudent,
    orderId: orderRes.data.orderId,
    paymentId: simRes.data.paymentId,
    signature: simRes.data.signature,
  });
  console.log('   Verify result:', verifyRes.data);
  if (!verifyRes.data.success || !verifyRes.data.studentId) {
    throw new Error('Online payment verification failed');
  }
  const onlineStudentId = verifyRes.data.studentId;
  console.log(`   ✅ Online Student Created with ID: ${onlineStudentId}`);

  // Step 4: Immediate Login Test
  console.log('4. Testing immediate login for Online Student (no manual admin approval required)...');
  const onlineLoginRes = await postForm('/student/login', {
    email: onlineStudent.email,
    password: onlineStudent.password,
  });

  if (onlineLoginRes.statusCode === 302 && onlineLoginRes.headers.location === '/student/dashboard') {
    console.log('   ✅ Online student logged in immediately and redirected to /student/dashboard!');
  } else {
    console.error('   ❌ Login failed:', onlineLoginRes.statusCode, onlineLoginRes.data);
    throw new Error('Online student should be able to log in immediately without manual approval');
  }

  // ----------------------------------------------------
  // TEST 2: CASH PAYMENT FLOW
  // ----------------------------------------------------
  console.log('\n--------------------------------------------------');
  console.log('▶️ TEST 2: CASH PAYMENT FLOW (₹150)');
  console.log('--------------------------------------------------');

  const cashStudent = {
    fullName: `Cash Tester ${ts}`,
    parentName: 'Parent Kumar',
    dateOfBirth: '2001-08-20',
    gender: 'female',
    mobile: `97${ts.padStart(8, '2')}`.slice(0, 10),
    email: `cash_${ts}@test.com`,
    password: 'Password@123',
    confirmPassword: 'Password@123',
    address: '404 MG Road',
    city: 'Patna',
    state: 'Bihar',
    pincode: '800001',
    college: 'NIT Patna',
    course: 'B.Tech IT',
    semester: '4th Semester',
    joiningDate: '2026-04-01',
    paymentMethod: 'cash',
  };

  // Step 1: Submit Cash Registration
  console.log('1. Student submits registration selecting Cash payment...');
  const cashRegRes = await postJson('/student/register', cashStudent);
  console.log('   Registration Response:', cashRegRes.data);
  if (!cashRegRes.data.success || !cashRegRes.data.studentId) {
    throw new Error('Cash registration failed');
  }
  const cashStudentId = cashRegRes.data.studentId;
  console.log(`   ✅ Cash Student Created with ID: ${cashStudentId} (Account: PENDING)`);

  // Step 2: Attempt Login Before Admin Verification (MUST BE BLOCKED)
  console.log('2. Attempting student login before admin verifies cash payment...');
  const cashLoginBlocked = await postForm('/student/login', {
    email: cashStudent.email,
    password: cashStudent.password,
  });

  if (cashLoginBlocked.data.includes('Cash payment pending: Please pay ₹150 at the SR Library desk')) {
    console.log('   ✅ Security check passed: Cash student blocked from logging in with pending cash payment alert!');
  } else {
    throw new Error('Security violation: Cash student was able to log in before cash verification!');
  }

  // Step 3: Admin Login
  console.log('3. Admin logs into Admin Panel...');
  const adminLoginRes = await postForm('/admin/login', {
    email: 'admin@srlibrary.com',
    password: 'Admin@123456',
  });
  const adminCookie = adminLoginRes.setCookie;
  console.log('   Admin logged in. Cookie acquired.');

  // Step 4: Admin checks Dashboard
  console.log('4. Admin visits Dashboard to see stats and Pending Cash Payments...');
  const dashRes = await getReq('/admin/dashboard', adminCookie);
  if (dashRes.data.includes('PENDING CASH PAYMENTS') && dashRes.data.includes(cashStudent.fullName)) {
    console.log(`   ✅ Cash student ${cashStudent.fullName} visible under PENDING CASH PAYMENTS!`);
  } else {
    console.log('   Notice: Checking students list for ID...');
  }

  // Find Student in Admin records
  const studentsListRes = await getReq(`/admin/students?search=${cashStudent.email}`, adminCookie);
  const studentMatch = studentsListRes.data.match(/\/admin\/students\/([a-f0-9]{24})/);
  if (!studentMatch) {
    throw new Error('Could not find student MongoDB ID in admin panel');
  }
  const studentMongoId = studentMatch[1];
  console.log(`   Found Student MongoDB ID: ${studentMongoId}`);

  // Step 5: Admin confirms Cash Payment Received
  console.log('5. Admin confirms receipt of ₹150 cash payment...');
  const markCashRes = await postJson(`/admin/students/${studentMongoId}/mark-cash-paid`, {
    note: '₹150 cash collected at library counter desk receipt #8821',
  }, adminCookie);
  console.log('   Admin Mark Cash Result:', markCashRes.data);
  if (!markCashRes.data.success) {
    throw new Error('Mark cash payment received failed: ' + markCashRes.data.message);
  }
  console.log('   ✅ Cash payment verified and account activated by Admin!');

  // Step 6: Cash Student Login After Verification
  console.log('6. Student attempts login now that cash payment is verified...');
  const cashLoginSuccess = await postForm('/student/login', {
    email: cashStudent.email,
    password: cashStudent.password,
  });

  if (cashLoginSuccess.statusCode === 302 && cashLoginSuccess.headers.location === '/student/dashboard') {
    console.log('   ✅ Cash student login SUCCEEDED! Redirected to /student/dashboard.');
  } else {
    throw new Error('Cash student should be able to log in after admin verifies payment!');
  }

  console.log('\n==================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  console.log('   - Online flow: Automatic approval + immediate login: PASS');
  console.log('   - Cash flow: Login blocked when pending: PASS');
  console.log('   - Cash flow: Admin verification + activation: PASS');
  console.log('   - Cash flow: Login succeeds after verification: PASS');
  console.log('==================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
