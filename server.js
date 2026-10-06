require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const port = Number(process.env.PORT) || 3000;
const adminPassword = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;

if (!adminPassword || !sessionSecret || sessionSecret.length < 32) {
    throw new Error('Set ADMIN_PASSWORD and a SESSION_SECRET of at least 32 characters in .env.');
}

const dataDirectory = path.join(__dirname, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });
const database = new Database(path.join(dataDirectory, 'library.db'));
database.pragma('journal_mode = WAL');
database.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER REFERENCES students(id),
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        plan TEXT NOT NULL,
        duration TEXT NOT NULL,
        plan_amount INTEGER NOT NULL,
        registration_fee INTEGER NOT NULL,
        total_amount INTEGER NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
`);
if (!database.pragma('table_info(bookings)').some((column) => column.name === 'student_id')) {
    database.exec('ALTER TABLE bookings ADD COLUMN student_id INTEGER REFERENCES students(id)');
}

const plans = {
    '4-hours': { label: '4 Hours', durations: { '1-month': 500, '2-months': 900, '3-months': 1300 } },
    '6-hours': { label: '6 Hours', durations: { '1-month': 700, '2-months': 1300, '3-months': 1900 } },
    '8-hours': { label: '8 Hours', durations: { '1-month': 900, '2-months': 1700, '3-months': 2500 } },
    'full-day': { label: 'Full Day', durations: {
        'unreserved-1-month': 1000,
        'unreserved-2-months': 1800,
        'unreserved-3-months': 2700,
        'reserved-1-month': 1100,
        'reserved-2-months': 2000,
        'reserved-3-months': 3000
    } }
};
const registrationFee = 150;
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const signupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10kb' }));

function signAdminToken(expiry) {
    return crypto.createHmac('sha256', sessionSecret).update(`admin:${expiry}`).digest('base64url');
}

function getAdminToken(request) {
    const cookie = request.headers.cookie || '';
    const tokenPair = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('library_admin='));
    if (!tokenPair) return null;

    const [expiry, signature] = decodeURIComponent(tokenPair.slice('library_admin='.length)).split('.');
    if (!expiry || !signature || Number(expiry) < Date.now()) return null;

    const expected = Buffer.from(signAdminToken(expiry));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    return true;
}

function requireAdmin(request, response, next) {
    if (!getAdminToken(request)) return response.status(401).json({ error: 'Admin login required.' });
    next();
}

function signStudentToken(studentId, expiry) {
    return crypto.createHmac('sha256', sessionSecret).update(`student:${studentId}:${expiry}`).digest('base64url');
}

function getStudentId(request) {
    const cookie = request.headers.cookie || '';
    const tokenPair = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('library_student='));
    if (!tokenPair) return null;

    const [studentId, expiry, signature] = decodeURIComponent(tokenPair.slice('library_student='.length)).split('.');
    if (!/^\d+$/.test(studentId) || !/^\d+$/.test(expiry) || Number(expiry) < Date.now() || !signature) return null;

    const expected = Buffer.from(signStudentToken(studentId, expiry));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    return Number(studentId);
}

function setStudentSession(response, studentId) {
    const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
    response.cookie('library_student', `${studentId}.${expiry}.${signStudentToken(studentId, expiry)}`, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000,
        path: '/'
    });
}

function requireStudent(request, response, next) {
    const studentId = getStudentId(request);
    if (!studentId) return response.status(401).json({ error: 'Student login required.' });
    request.studentId = studentId;
    next();
}

function derivePassword(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (error, derivedKey) => {
            if (error) reject(error);
            else resolve(derivedKey);
        });
    });
}

async function verifyStudentPassword(password, storedHash) {
    const [salt, storedKey] = storedHash.split(':');
    if (!salt || !storedKey) return false;
    const actualKey = await derivePassword(password, salt);
    const expectedKey = Buffer.from(storedKey, 'hex');
    return actualKey.length === expectedKey.length && crypto.timingSafeEqual(actualKey, expectedKey);
}

function normalizedPhone(value) {
    return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function validStudentInput(name, phone, password) {
    return name.length >= 2 && name.length <= 100
        && /^[6-9]\d{9}$/.test(phone)
        && password.length >= 8 && password.length <= 128;
}

function invalidStudentInput(response) {
    return response.status(400).json({ error: 'Use a 2–100 character name, valid 10-digit Indian mobile number, and password of 8–128 characters.' });
}

app.get('/api/admin/session', (request, response) => {
    response.json({ authenticated: Boolean(getAdminToken(request)) });
});

app.get('/api/auth/session', (request, response) => {
    if (getAdminToken(request)) return response.json({ role: 'admin' });
    const studentId = getStudentId(request);
    response.json({ role: studentId ? 'student' : null });
});

app.post('/api/student/signup', signupLimiter, async (request, response) => {
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
    const phone = normalizedPhone(request.body?.phone);
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (!validStudentInput(name, phone, password)) return invalidStudentInput(response);

    try {
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = `${salt}:${(await derivePassword(password, salt)).toString('hex')}`;
        const result = database.prepare(`
            INSERT INTO students (name, phone, password_hash, created_at) VALUES (?, ?, ?, ?)
        `).run(name, phone, passwordHash, new Date().toISOString());
        setStudentSession(response, result.lastInsertRowid);
        response.status(201).json({ ok: true });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return response.status(409).json({ error: 'An account with this mobile number already exists.' });
        response.status(500).json({ error: 'Could not create the account.' });
    }
});

app.post('/api/student/login', loginLimiter, async (request, response) => {
    const phone = normalizedPhone(request.body?.phone);
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (!/^[6-9]\d{9}$/.test(phone) || !password) return response.status(400).json({ error: 'Enter a valid mobile number and password.' });

    const student = database.prepare('SELECT id, password_hash FROM students WHERE phone = ?').get(phone);
    if (!student || !(await verifyStudentPassword(password, student.password_hash))) {
        return response.status(401).json({ error: 'Mobile number or password is incorrect.' });
    }
    setStudentSession(response, student.id);
    response.json({ ok: true });
});

app.post('/api/student/logout', (request, response) => {
    response.clearCookie('library_student', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
    response.json({ ok: true });
});

app.get('/api/student/profile', requireStudent, (request, response) => {
    const student = database.prepare('SELECT id, name, phone, created_at FROM students WHERE id = ?').get(request.studentId);
    if (!student) return response.status(401).json({ error: 'Student account not found.' });
    response.json({ student });
});

app.get('/api/student/bookings', requireStudent, (request, response) => {
    const bookings = database.prepare(`
        SELECT id, plan, duration, plan_amount, registration_fee, total_amount, payment_status, created_at
        FROM bookings WHERE student_id = ? ORDER BY id DESC LIMIT 100
    `).all(request.studentId);
    response.json({ bookings });
});

app.get('/api/plans', (request, response) => {
    response.json({ plans, registrationFee });
});

app.post('/api/bookings', (request, response) => {
    const body = request.body || {};
    const studentId = getStudentId(request);
    const student = studentId ? database.prepare('SELECT name, phone FROM students WHERE id = ?').get(studentId) : null;
    const name = student?.name || (typeof body.name === 'string' ? body.name.trim() : '');
    const phone = student?.phone || normalizedPhone(body.phone);
    const planKey = body.plan;
    const duration = body.duration;
    const plan = plans[planKey];
    const amount = plan?.durations[duration];

    if (name.length < 2 || name.length > 100) return response.status(400).json({ error: 'Enter a name between 2 and 100 characters.' });
    if (!/^[6-9]\d{9}$/.test(phone)) return response.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number.' });
    if (!amount) return response.status(400).json({ error: 'Choose a valid plan and duration.' });

    const total = amount + registrationFee;
    const result = database.prepare(`
        INSERT INTO bookings (student_id, name, phone, plan, duration, plan_amount, registration_fee, total_amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(student?.name ? studentId : null, name, phone, plan.label, duration, amount, registrationFee, total, new Date().toISOString());

    response.status(201).json({
        id: result.lastInsertRowid,
        amount,
        registrationFee,
        total,
        status: 'pending',
        demoOnly: true
    });
});

app.post('/api/bookings/:id/demo-pay', (request, response) => {
    const bookingId = Number(request.params.id);
    if (!Number.isSafeInteger(bookingId) || bookingId < 1) return response.status(400).json({ error: 'Invalid booking.' });

    const result = database.prepare(`
        UPDATE bookings SET payment_status = 'demo_paid'
        WHERE id = ? AND payment_status = 'pending'
    `).run(bookingId);

    if (result.changes === 0) return response.status(404).json({ error: 'Booking not found or already completed.' });
    response.json({ status: 'demo_paid', demoOnly: true });
});

app.post('/api/admin/login', loginLimiter, (request, response) => {
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    const expected = crypto.createHash('sha256').update(adminPassword).digest();
    const actual = crypto.createHash('sha256').update(password).digest();
    if (!crypto.timingSafeEqual(actual, expected)) return response.status(401).json({ error: 'Incorrect password.' });

    const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
    response.cookie('library_admin', `${expiry}.${signAdminToken(expiry)}`, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000,
        path: '/'
    });
    response.json({ ok: true });
});

app.post('/api/admin/logout', (request, response) => {
    response.clearCookie('library_admin', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
    response.json({ ok: true });
});

app.get('/api/admin/bookings', requireAdmin, (request, response) => {
    const bookings = database.prepare(`
        SELECT id, name, phone, plan, duration, plan_amount, registration_fee, total_amount, payment_status, created_at
        FROM bookings ORDER BY id DESC LIMIT 500
    `).all();
    response.json({ bookings });
});

app.get('/api/admin/summary', requireAdmin, (request, response) => {
    const summary = database.prepare(`
        SELECT COUNT(*) AS bookings,
               COALESCE(SUM(CASE WHEN payment_status = 'demo_paid' THEN total_amount ELSE 0 END), 0) AS demoPaidAmount,
               SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) AS pending
        FROM bookings
    `).get();
    response.json({ summary });
});

app.use((request, response, next) => {
    const blocked = /(^|\/)(?:data|node_modules)(?:\/|$)|\.(?:env)(?:\.|$)|\/(?:server\.js|package(?:-lock)?\.json)$/i;
    if (blocked.test(decodeURIComponent(request.path))) return response.sendStatus(404);
    next();
});
app.use(express.static(__dirname, { dotfiles: 'deny', index: 'index.html' }));

app.listen(port, () => console.log(`SR Library demo server running at http://localhost:${port}`));