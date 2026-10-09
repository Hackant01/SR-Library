require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const connectMongo = require('connect-mongo');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const axios = require('axios');
const connectDB = require('./config/db');
const Admin = require('./models/Admin');
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/studentRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

const MongoStore = connectMongo.default || connectMongo.MongoStore || connectMongo;


const urlIn = "https://srlibrary.co.in";

const interval = 60000;

function reloadWebsite() {
  axios
    .get(urlIn)
    .then((response) => {
      // console.log("website reloded .in");
    })
    .catch((error) => {
      console.error(`Error (.in) : ${error.message}`);
    });
}

setInterval(reloadWebsite, interval);

const startServer = async () => {
  // ─── Connect to MongoDB ───────────────────────────────────────────────────
  await connectDB();

  // ─── Initialize Study Seats ───────────────────────────────────────────────
  const initSeats = require('./utils/initSeats');
  await initSeats();

  // ─── Auto-Seed Admin if None Exists ─────────────────────────────────────
  try {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@srlibrary.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
      await Admin.create({
        name: 'Super Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'superadmin',
      });
      console.log(`🎉 Super Admin created! Email: ${adminEmail} | Password: ${adminPassword}`);
    }
  } catch (err) {
    console.warn('⚠️ Admin auto-seed notice:', err.message);
  }

  // ─── Security Middleware ──────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com', 'https://cdn.razorpay.com'],
          frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
          connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        },
      },
    })
  );

  // ─── Logging ──────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // ─── Body Parsers ─────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ─── Session ──────────────────────────────────────────────────────────────
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'fallback_secret',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client: mongoose.connection.getClient(),
        ttl: 24 * 60 * 60, // 1 day
      }),
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      },
    })
  );

  // ─── View Engine ──────────────────────────────────────────────────────────
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // ─── Static Files ─────────────────────────────────────────────────────────
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.static(__dirname, { index: false }));

  // ─── Global Template Variables ────────────────────────────────────────────
  app.use((req, res, next) => {
    res.locals.libraryName = process.env.LIBRARY_NAME || 'SR Library';
    res.locals.currentYear = new Date().getFullYear();
    next();
  });

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.get('/', async (req, res) => {
    try {
      const Seat = require('./models/Seat');
      const [availableSeats, totalSeats] = await Promise.all([
        Seat.countDocuments({ status: 'available' }),
        Seat.countDocuments(),
      ]);
      res.render('home', {
        title: `${process.env.LIBRARY_NAME || 'SR Library'} - Physical Study Library & Seat Booking`,
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
        availableSeats: availableSeats || 35,
        totalSeats: totalSeats || 40,
      });
    } catch (e) {
      res.render('home', {
        title: `${process.env.LIBRARY_NAME || 'SR Library'} - Physical Study Library & Seat Booking`,
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
        availableSeats: 35,
        totalSeats: 40,
      });
    }
  });

  // Public Seat Availability View
  app.get('/seat-availability', async (req, res) => {
    try {
      const Seat = require('./models/Seat');
      const seats = await Seat.find().sort({ seatNumber: 1 });
      const availableCount = seats.filter((s) => s.status === 'available').length;
      res.render('seat-availability', {
        title: `Seat Availability | ${process.env.LIBRARY_NAME || 'SR Library'}`,
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
        seats,
        availableCount,
        totalCount: seats.length,
      });
    } catch (e) {
      res.redirect('/');
    }
  });

  // Redirects
  app.get('/index.html', (req, res) => res.redirect('/'));
  app.get('/register', (req, res) => res.redirect('/student/register'));

  app.use('/student', studentRoutes);
  app.use('/admin', adminRoutes);

  // ─── 404 Handler ──────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).render('error', {
      title: '404 - Not Found',
      message: 'The page you are looking for does not exist.',
    });
  });

  // ─── Global Error Handler ─────────────────────────────────────────────────
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An unexpected error occurred. Please try again.',
    });
  });

  // ─── Start Server ─────────────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 Library: ${process.env.LIBRARY_NAME || 'SR Library'}`);
    console.log(`🔑 Admin Login: http://localhost:${PORT}/admin/login`);
    console.log(`📝 Student Register: http://localhost:${PORT}/student/register`);
    console.log(`==================================================\n`);
  });
};

startServer();

module.exports = app;
