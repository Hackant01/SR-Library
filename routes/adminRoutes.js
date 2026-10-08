const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/adminController');
const { adminAuth } = require('../middleware/adminAuth');

// Rate limiter for admin login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many login attempts. Please try again later.',
});

// Public routes
router.get('/login', adminController.getLogin);
router.post('/login', loginLimiter, adminController.postLogin);
router.post('/logout', adminController.postLogout);

// Protected routes
router.get('/dashboard', adminAuth, adminController.getDashboard);
router.get('/students', adminAuth, adminController.getStudents);
router.get('/seats', adminAuth, adminController.getSeats);
router.post('/seats/:id/status', adminAuth, adminController.updateSeatStatus);
router.get('/bookings', adminAuth, adminController.getBookings);
router.post('/bookings/:id/cancel', adminAuth, adminController.cancelBooking);
router.get('/api/seats', adminAuth, adminController.getSeatsApi);
router.get('/payments', adminAuth, adminController.getPayments);
router.get('/students/:id', adminAuth, adminController.getStudentDetail);
router.get('/students/:id/print', adminAuth, adminController.printStudentForm);
router.post('/students/:id/assign-id', adminAuth, adminController.assignStudentId);
router.post('/students/:id/approve', adminAuth, adminController.approveStudent);
router.post('/students/:id/mark-cash-paid', adminAuth, adminController.markCashPaymentReceived);
router.post('/students/:id/reject', adminAuth, adminController.rejectStudent);
router.post('/students/:id/activate', adminAuth, adminController.activateStudent);
router.post('/students/:id/deactivate', adminAuth, adminController.deactivateStudent);
router.post('/students/:id/delete', adminAuth, adminController.deleteStudent);
router.post('/students/:id/resend-email', adminAuth, adminController.resendEmail);
router.get('/profile', adminAuth, adminController.getProfile);

module.exports = router;
