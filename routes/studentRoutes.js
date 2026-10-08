const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const studentController = require('../controllers/studentController');
const { studentAuth } = require('../middleware/adminAuth');

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again later.',
});

// Public student routes
router.get('/register', studentController.getRegister);
router.post('/register', studentController.postRegister);
router.post('/create-order', studentController.createPaymentOrder);
router.post('/simulate-payment', studentController.simulateGatewayPayment);
router.post('/verify-payment', studentController.verifyOnlinePayment);
router.get('/registration-success', studentController.getRegistrationSuccess);

// Student login & password
router.get('/login', studentController.getLogin);
router.post('/login', loginLimiter, studentController.postLogin);
router.get('/forgot-password', studentController.getForgotPassword);

// Seats API
router.get('/api/seats', studentController.getSeatsApi);

// Protected student routes
router.get('/dashboard', studentAuth, studentController.getDashboard);
router.get('/booking', studentAuth, studentController.getSeatBooking);
router.post('/book-seat', studentAuth, studentController.postBookSeat);
router.post('/cancel-booking/:id', studentAuth, studentController.cancelBooking);
router.get('/profile', studentAuth, studentController.getProfile);
router.post('/logout', studentController.postLogout);

module.exports = router;
