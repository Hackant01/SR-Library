const http = require('http');

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('==================================================');
  console.log('🧪 RUNNING COMPREHENSIVE INTEGRATION SUITE');
  console.log('==================================================\n');

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

  // 1. Test Homepage
  console.log('--- 1. Testing Homepage (GET /) ---');
  try {
    const res = await request({ hostname: 'localhost', port: 5000, path: '/', method: 'GET' });
    assert(res.statusCode === 200, 'Homepage returns status 200');
    assert(res.body.includes('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'), 'Homepage includes Font Awesome');
    assert(res.body.includes('fa-brands fa-whatsapp'), 'Homepage includes WhatsApp icon');
    assert(res.body.includes('fa-brands fa-instagram'), 'Homepage includes Instagram icon');
    assert(res.body.includes('https://www.instagram.com/sr_self_study_zone_and_library'), 'Homepage has real Instagram link');
    assert(res.body.includes('https://wa.me/918103485288'), 'Homepage has real WhatsApp link');
    assert(res.body.includes('whatsapp-float'), 'Homepage has floating WhatsApp button');
    assert(res.body.includes('id="mobileDrawer"'), 'Homepage has mobile navigation drawer');
    assert(!res.body.includes('Special Launch Offer'), 'Homepage does NOT have old promotional banner');
    assert(res.body.includes('id="about"'), 'Homepage has #about section');
    assert(res.body.includes('id="facilities"'), 'Homepage has #facilities section');
    assert(res.body.includes('id="how-it-works"'), 'Homepage has #how-it-works section');
  } catch (err) {
    assert(false, `Homepage failed: ${err.message}`);
  }

  // 2. Test Seat Availability
  console.log('\n--- 2. Testing Seat Availability (GET /seat-availability) ---');
  try {
    const res = await request({ hostname: 'localhost', port: 5000, path: '/seat-availability', method: 'GET' });
    assert(res.statusCode === 200, 'Seat availability returns status 200');
    assert(res.body.includes('data-seat="43"'), 'Contains Seat 43');
    assert(res.body.includes('data-seat="1"'), 'Contains Seat 1');
    assert(/data-seat="13"[\s\S]*?data-status="locked"/.test(res.body), 'Seat 13 is locked');
    assert(/data-seat="14"[\s\S]*?data-status="locked"/.test(res.body), 'Seat 14 is locked');
    assert(/data-seat="15"[\s\S]*?data-status="locked"/.test(res.body), 'Seat 15 is locked');
    assert(/data-seat="17"[\s\S]*?data-status="locked"/.test(res.body), 'Seat 17 is locked');
    assert(/data-seat="19"[\s\S]*?data-status="locked"/.test(res.body), 'Seat 19 is locked');
    assert(!/data-seat="22"[\s\S]*?data-status="locked"/.test(res.body), 'Seat 22 is NOT locked');
    assert(!/data-seat="24"[\s\S]*?data-status="locked"/.test(res.body), 'Seat 24 is NOT locked');
    assert(!/<button[^>]*data-seat="34"[^>]*data-status="locked"/.test(res.body), 'Seat 34 is NOT locked');
    assert(res.body.includes('Door'), 'Visual seating blueprint contains entrance Door');
    assert(res.body.includes('Left Wall'), 'Blueprint models Left Wall column (43 down to 31)');
  } catch (err) {
    assert(false, `Seat availability failed: ${err.message}`);
  }

  // 3. Test Admin Login and Cookies
  console.log('\n--- 3. Testing Admin Login (POST /admin/login) ---');
  let adminCookie = '';
  try {
    const loginPayload = 'email=admin%40srlibrary.com&password=Admin%40123456';
    const res = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginPayload),
      },
    }, loginPayload);

    assert(res.statusCode === 302, 'Admin login redirects with status 302');
    const setCookie = res.headers['set-cookie'];
    assert(setCookie && setCookie.some(c => c.includes('adminToken=')), 'Admin token cookie received');
    if (setCookie) {
      adminCookie = setCookie.map(c => c.split(';')[0]).join('; ');
    }
  } catch (err) {
    assert(false, `Admin login failed: ${err.message}`);
  }

  // 4. Test Protected Admin Views
  console.log('\n--- 4. Testing Admin Dashboard & Students Views ---');
  try {
    const dashRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/admin/dashboard',
      method: 'GET',
      headers: { 'Cookie': adminCookie },
    });
    assert(dashRes.statusCode === 200, 'Admin dashboard accessible (status 200)');
    assert(dashRes.body.includes('fa-solid fa-gauge-high'), 'Admin dashboard renders Font Awesome');

    const studentsRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/admin/students',
      method: 'GET',
      headers: { 'Cookie': adminCookie },
    });
    assert(studentsRes.statusCode === 200, 'Admin students page accessible (status 200)');
    assert(studentsRes.body.includes('actions-dropdown-container'), 'Admin students table includes organized actions dropdown');
    assert(studentsRes.body.includes('LIB20260009'), 'Admin students page displays student records');

    const seatsRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/admin/seats',
      method: 'GET',
      headers: { 'Cookie': adminCookie },
    });
    assert(seatsRes.statusCode === 200, 'Admin seats page accessible (status 200)');
    assert(seatsRes.body.includes('Total Hall Seats') && seatsRes.body.includes('43'), 'Admin seats displays full 43 seats');
  } catch (err) {
    assert(false, `Admin views failed: ${err.message}`);
  }

  // 5. Test Resend Email Behavior
  console.log('\n--- 5. Testing Resend Email API Behavior ---');
  try {
    const studentsRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/admin/students',
      method: 'GET',
      headers: { 'Cookie': adminCookie },
    });
    const match = studentsRes.body.match(/resendEmail\('([a-f0-9]{24})'/);
    if (match) {
      const studentMongoId = match[1];
      const resendRes = await request({
        hostname: 'localhost',
        port: 5000,
        path: `/admin/students/${studentMongoId}/resend-email`,
        method: 'POST',
        headers: {
          'Cookie': adminCookie,
          'Content-Type': 'application/json',
          'Content-Length': 0,
        },
      });
      const data = JSON.parse(resendRes.body);
      assert(resendRes.statusCode === 503 || resendRes.statusCode === 200, `Resend email response code: ${resendRes.statusCode}`);
      if (resendRes.statusCode === 503) {
        assert(data.notConfigured === true, 'Resend email reports honest notConfigured: true when SMTP credentials are placeholder');
        assert(data.message.includes('not configured in .env'), 'Resend email gives clear, truthful error message to admin');
      }
    } else {
      assert(false, 'Could not find student Mongo ID to test resend email');
    }
  } catch (err) {
    assert(false, `Resend email test failed: ${err.message}`);
  }

  // 6. Test Student Login Page & Protected Redirection
  console.log('\n--- 6. Testing Student Portal Flow ---');
  try {
    const loginPage = await request({ hostname: 'localhost', port: 5000, path: '/student/login', method: 'GET' });
    assert(loginPage.statusCode === 200, 'Student login page returns status 200');

    const regPage = await request({ hostname: 'localhost', port: 5000, path: '/student/register', method: 'GET' });
    assert(regPage.statusCode === 200, 'Student registration page returns status 200');

    // Unauthenticated booking should redirect to login
    const unauthBooking = await request({ hostname: 'localhost', port: 5000, path: '/student/booking', method: 'GET' });
    assert(unauthBooking.statusCode === 302 && unauthBooking.headers.location === '/student/login', 'Unauthenticated booking redirects to /student/login');
  } catch (err) {
    assert(false, `Student portal flow failed: ${err.message}`);
  }

  console.log('\n==================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');
}

runTests();
