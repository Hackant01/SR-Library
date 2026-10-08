const crypto = require('crypto');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const Seat = require('../models/Seat');
const Booking = require('../models/Booking');
const { validateStudentRegistration } = require('../middleware/validation');
const generateStudentId = require('../utils/generateStudentId');
const { sendStudentIdEmail } = require('../services/emailService');

const getHmacSecret = () => {
  return process.env.RAZORPAY_KEY_SECRET || process.env.JWT_SECRET || 'srlibrary_secure_payment_salt';
};

// ─── Show Registration Form ───────────────────────────────────────────────────
const getRegister = (req, res) => {
  res.render('student/register', {
    title: 'Student Registration',
    errors: [],
    formData: {},
    libraryName: process.env.LIBRARY_NAME || 'SR Library',
  });
};

// ─── Create Payment Order (for Online Gateway) ─────────────────────────────────
const createPaymentOrder = async (req, res) => {
  try {
    const orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    res.json({
      success: true,
      orderId,
      amount: 150,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_srlibrary',
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ success: false, message: 'Could not create payment order' });
  }
};

// ─── Simulate Gateway Payment (Generates Cryptographic HMAC Signature) ────────
const simulateGatewayPayment = async (req, res) => {
  try {
    const { orderId, method } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const secret = getHmacSecret();
    const signature = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

    res.json({
      success: true,
      orderId,
      paymentId,
      signature,
      method: method || 'upi',
    });
  } catch (err) {
    console.error('Simulate payment error:', err);
    res.status(500).json({ success: false, message: 'Error processing simulation' });
  }
};

// ─── Verify Online Payment & Create Approved Active Student ───────────────────
const verifyOnlinePayment = async (req, res) => {
  try {
    const data = req.body;
    const orderId = data.orderId || data.razorpay_order_id;
    const paymentId = data.paymentId || data.razorpay_payment_id;
    const signature = data.signature || data.razorpay_signature;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification details (orderId, paymentId, signature required)',
      });
    }

    // Cryptographic signature verification
    const secret = getHmacSecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Verification failed on server.',
      });
    }

    // Validate form inputs
    const errors = validateStudentRegistration(data);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join(', '), errors });
    }

    // Check uniqueness
    const existingEmail = await Student.findOne({ email: data.email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'This email is already registered.' });
    }

    const existingMobile = await Student.findOne({ mobile: data.mobile.trim() });
    if (existingMobile) {
      return res.status(400).json({ success: false, message: 'This mobile number is already registered.' });
    }

    // Automatically generate unique Student ID
    const studentId = await generateStudentId();

    // Create student: ONLINE -> PAID, APPROVED, ACTIVE
    const student = new Student({
      studentId,
      fullName: data.fullName.trim(),
      parentName: data.parentName.trim(),
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      address: data.address.trim(),
      mobile: data.mobile.trim(),
      emergencyContact: data.emergencyContact ? data.emergencyContact.trim() : '',
      email: data.email.toLowerCase().trim(),
      password: data.password,
      idProofType: data.idProofType ? data.idProofType.trim() : '',
      idProofNumber: data.idProofNumber ? data.idProofNumber.trim() : '',
      educationLevel: data.educationLevel ? data.educationLevel.trim() : '',
      preparingFor: data.preparingFor ? data.preparingFor.trim() : '',
      membershipSlot: data.membershipSlot ? data.membershipSlot.trim() : '',
      subscriptionPlan: data.subscriptionPlan ? data.subscriptionPlan.trim() : '',
      slotTiming: data.slotTiming ? data.slotTiming.trim() : '',
      joiningDate: data.joiningDate,
      declarationAccepted: true,
      registrationFee: 150,
      paymentMethod: 'online',
      paymentStatus: 'paid',
      approvalStatus: 'approved',
      accountStatus: 'active',
      emailStatus: 'pending',
    });

    await student.save();

    // Create verified Payment record
    const payment = new Payment({
      student: student._id,
      amount: 150,
      currency: 'INR',
      paymentMethod: 'online',
      status: 'paid',
      orderId,
      paymentId,
      signature,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
      paymentDate: new Date(),
    });

    await payment.save();

    student.paymentId = payment._id;

    // Send confirmation email with Student ID & login details
    try {
      await sendStudentIdEmail(student);
      student.emailStatus = 'sent';
      await student.save();
    } catch (emailErr) {
      console.error('Online registration email failed:', emailErr.message);
      student.emailStatus = 'failed';
      await student.save();
    }

    req.session.registeredStudent = {
      name: student.fullName,
      email: student.email,
      studentId: student.studentId,
      fee: 150,
      paymentMethod: 'online',
      paymentStatus: 'paid',
      approvalStatus: 'approved',
      accountStatus: 'active',
      transactionId: paymentId,
    };

    res.json({
      success: true,
      message: 'Online payment verified successfully! Account is active.',
      studentId: student.studentId,
      redirectUrl: '/student/registration-success',
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ success: false, message: 'Server error during payment verification' });
  }
};

// ─── Handle Registration POST (for CASH Payment) ──────────────────────────────
const postRegister = async (req, res) => {
  try {
    const formData = req.body;
    const paymentMethod = formData.paymentMethod === 'cash' ? 'cash' : 'online';

    // If online was chosen through standard POST form, instruct user to use online checkout
    if (paymentMethod === 'online' && !formData.paymentId) {
      return res.render('student/register', {
        title: 'Student Registration',
        errors: ['Online payment requires gateway checkout. Please select Cash or complete the Online Payment.'],
        formData,
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    // Backend validation
    const errors = validateStudentRegistration(formData);
    if (errors.length > 0) {
      return res.render('student/register', {
        title: 'Student Registration',
        errors,
        formData,
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    // Check uniqueness
    const existingEmail = await Student.findOne({ email: formData.email.toLowerCase().trim() });
    if (existingEmail) {
      return res.render('student/register', {
        title: 'Student Registration',
        errors: ['This email is already registered'],
        formData,
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    const existingMobile = await Student.findOne({ mobile: formData.mobile.trim() });
    if (existingMobile) {
      return res.render('student/register', {
        title: 'Student Registration',
        errors: ['This mobile number is already registered'],
        formData,
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    // Automatically generate unique Student ID
    const studentId = await generateStudentId();

    // CASH REGISTRATION: PENDING, PENDING, PENDING
    const student = new Student({
      studentId,
      fullName: formData.fullName.trim(),
      parentName: formData.parentName.trim(),
      dateOfBirth: formData.dateOfBirth,
      gender: formData.gender,
      address: formData.address.trim(),
      mobile: formData.mobile.trim(),
      emergencyContact: formData.emergencyContact ? formData.emergencyContact.trim() : '',
      email: formData.email.toLowerCase().trim(),
      password: formData.password,
      idProofType: formData.idProofType ? formData.idProofType.trim() : '',
      idProofNumber: formData.idProofNumber ? formData.idProofNumber.trim() : '',
      educationLevel: formData.educationLevel ? formData.educationLevel.trim() : '',
      preparingFor: formData.preparingFor ? formData.preparingFor.trim() : '',
      membershipSlot: formData.membershipSlot ? formData.membershipSlot.trim() : '',
      subscriptionPlan: formData.subscriptionPlan ? formData.subscriptionPlan.trim() : '',
      slotTiming: formData.slotTiming ? formData.slotTiming.trim() : '',
      joiningDate: formData.joiningDate,
      declarationAccepted: true,
      registrationFee: 150,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      approvalStatus: 'pending',
      accountStatus: 'pending',
      emailStatus: 'pending',
    });

    await student.save();

    // Create pending Cash Payment record
    const payment = new Payment({
      student: student._id,
      amount: 150,
      currency: 'INR',
      paymentMethod: 'cash',
      status: 'pending',
    });
    await payment.save();

    student.paymentId = payment._id;
    await student.save();

    // DO NOT send approval email yet! Only send after admin verifies cash.

    req.session.registeredStudent = {
      name: student.fullName,
      email: student.email,
      studentId: student.studentId,
      fee: 150,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      approvalStatus: 'pending',
      accountStatus: 'pending',
    };

    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.json({
        success: true,
        message: 'Registration submitted! Please pay ₹150 cash at the library counter.',
        studentId: student.studentId,
        redirectUrl: '/student/registration-success',
      });
    }

    res.redirect('/student/registration-success');
  } catch (err) {
    console.error('Registration error:', err);
    res.render('student/register', {
      title: 'Student Registration',
      errors: ['Server error. Please try again.'],
      formData: req.body,
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  }
};

// ─── Registration Success Page ────────────────────────────────────────────────
const getRegistrationSuccess = (req, res) => {
  const regData = req.session.registeredStudent || {
    name: null,
    studentId: null,
    email: null,
    fee: 150,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    approvalStatus: 'pending',
    accountStatus: 'pending',
  };

  res.render('student/registration-success', {
    title: regData.paymentMethod === 'online' ? 'Registration & Payment Successful' : 'Registration Submitted (Cash Pending)',
    libraryName: process.env.LIBRARY_NAME || 'SR Library',
    student: regData,
  });
};

// ─── Student Login ────────────────────────────────────────────────────────────
const getLogin = (req, res) => {
  if (req.session?.studentId) return res.redirect('/student/dashboard');
  res.render('student/login', {
    title: 'Student Login',
    error: null,
    libraryName: process.env.LIBRARY_NAME || 'SR Library',
  });
};

const postLogin = async (req, res) => {
  try {
    const rawIdentifier = (req.body.email || req.body.mobile || req.body.identifier || '').trim();
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      return res.render('student/login', {
        title: 'Student Login',
        error: 'Please enter your registered Email or Mobile number and Password',
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    const student = await Student.findOne({
      $or: [
        { email: rawIdentifier.toLowerCase() },
        { mobile: rawIdentifier },
      ],
    });

    if (!student) {
      return res.render('student/login', {
        title: 'Student Login',
        error: 'Invalid login details. If you have not registered yet, please create an account.',
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.render('student/login', {
        title: 'Student Login',
        error: 'Invalid password. Please check your password and try again.',
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    // Business Rules for Login Access:
    // CASH PENDING:
    if (student.paymentMethod === 'cash' && student.paymentStatus === 'pending') {
      return res.render('student/login', {
        title: 'Student Login',
        error: '⏳ Cash payment pending: Please pay ₹150 at the SR Library counter. Once admin confirms your cash payment, your account will be activated and login access enabled.',
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    // GENERAL PENDING:
    if (student.accountStatus === 'pending' || student.approvalStatus === 'pending') {
      return res.render('student/login', {
        title: 'Student Login',
        error: '⏳ Your registration is currently Pending Admin Approval. Once approved, you will receive an activation email with login access.',
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    // REJECTED:
    if (student.accountStatus === 'rejected' || student.approvalStatus === 'rejected') {
      return res.render('student/login', {
        title: 'Student Login',
        error: '❌ Your registration application was rejected by the library administrator. Please visit or contact the library desk.',
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    // INACTIVE:
    if (student.accountStatus === 'inactive') {
      return res.render('student/login', {
        title: 'Student Login',
        error: '⚠️ Your account is currently inactive. Please contact library management to reactivate.',
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    // APPROVED & ACTIVE:
    req.session.studentId = student._id.toString();
    res.redirect('/student/dashboard');
  } catch (err) {
    console.error('Student login error:', err);
    res.render('student/login', {
      title: 'Student Login',
      error: 'Server error. Please try again.',
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  }
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
const getForgotPassword = (req, res) => {
  res.render('student/forgot-password', {
    title: 'Forgot Password',
    libraryName: process.env.LIBRARY_NAME || 'SR Library',
  });
};

// ─── Student Dashboard ────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const student = await Student.findById(req.session.studentId).select('-password');
    if (!student) {
      req.session.destroy();
      return res.redirect('/student/login');
    }

    const [payment, activeBooking, bookingHistory, availableSeatsCount] = await Promise.all([
      Payment.findOne({ student: student._id }),
      Booking.findOne({ student: student._id, status: 'active' }).populate('seat'),
      Booking.find({ student: student._id }).sort({ createdAt: -1 }).limit(10).populate('seat'),
      Seat.countDocuments({ status: 'available' }),
    ]);

    res.render('student/dashboard', {
      title: 'Student Dashboard',
      student,
      payment,
      activeBooking,
      bookingHistory,
      availableSeatsCount,
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  } catch (err) {
    console.error('Student dashboard error:', err);
    res.status(500).render('error', { message: 'Failed to load dashboard', title: 'Error' });
  }
};

// ─── Visual Seat Booking Page ─────────────────────────────────────────────────
const getSeatBooking = async (req, res) => {
  try {
    const student = await Student.findById(req.session.studentId).select('-password');
    if (!student) return res.redirect('/student/login');

    const [seats, activeBooking] = await Promise.all([
      Seat.find().sort({ seatNumber: 1 }),
      Booking.findOne({ student: student._id, status: 'active' }).populate('seat'),
    ]);

    // Group seats by section
    const sectionA = seats.filter((s) => s.section.includes('Section A') || s.seatNumber.startsWith('A-'));
    const sectionB = seats.filter((s) => s.section.includes('Section B') || s.seatNumber.startsWith('B-'));

    res.render('student/booking', {
      title: 'Book a Study Seat',
      student,
      activeBooking,
      sectionA,
      sectionB,
      seats,
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  } catch (err) {
    console.error('Get seat booking error:', err);
    res.status(500).render('error', { message: 'Failed to load seat booking page', title: 'Error' });
  }
};

// ─── Post Seat Booking ────────────────────────────────────────────────────────
const postBookSeat = async (req, res) => {
  try {
    const student = await Student.findById(req.session.studentId);
    if (!student) {
      return res.status(401).json({ success: false, message: 'Please log in to book a seat.' });
    }

    const { seatNumber, slot, date, notes } = req.body;
    if (!seatNumber) {
      return res.status(400).json({ success: false, message: 'Please select a seat.' });
    }

    const seat = await Seat.findOne({ seatNumber: seatNumber.toUpperCase().trim() });
    if (!seat) {
      return res.status(404).json({ success: false, message: 'Selected seat does not exist.' });
    }

    if (seat.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: `Seat ${seat.seatNumber} is currently ${seat.status}. Please choose an available seat.`,
      });
    }

    // If student already has an active booking, free their previous seat
    const previousBooking = await Booking.findOne({ student: student._id, status: 'active' });
    if (previousBooking) {
      previousBooking.status = 'completed';
      await previousBooking.save();
      await Seat.findByIdAndUpdate(previousBooking.seat, {
        status: 'available',
        currentBooking: null,
        currentStudent: null,
      });
    }

    // Generate unique booking code
    const bookingCode = 'BK' + Date.now().toString().slice(-6) + Math.random().toString(36).substring(2, 5).toUpperCase();

    const booking = new Booking({
      bookingId: bookingCode,
      student: student._id,
      studentName: student.fullName,
      studentMobile: student.mobile,
      studentEmail: student.email,
      seat: seat._id,
      seatNumber: seat.seatNumber,
      bookingDate: date ? new Date(date) : new Date(),
      slot: slot || student.membershipSlot || 'Full Day (6:00 AM - 11:00 PM)',
      plan: student.subscriptionPlan || 'Monthly Membership',
      status: 'active',
      notes: notes || '',
    });

    await booking.save();

    // Mark seat as occupied
    seat.status = 'occupied';
    seat.currentBooking = booking._id;
    seat.currentStudent = student._id;
    await seat.save();

    res.json({
      success: true,
      message: `🎉 Seat ${seat.seatNumber} successfully booked! Your booking ID is ${bookingCode}.`,
      bookingId: bookingCode,
      seatNumber: seat.seatNumber,
      redirectUrl: '/student/dashboard',
    });
  } catch (err) {
    console.error('Post seat booking error:', err);
    res.status(500).json({ success: false, message: 'Failed to complete seat booking. Please try again.' });
  }
};

// ─── Cancel Booking ───────────────────────────────────────────────────────────
const cancelBooking = async (req, res) => {
  try {
    const student = await Student.findById(req.session.studentId);
    if (!student) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const bookingId = req.params.id;
    const booking = await Booking.findOne({ _id: bookingId, student: student._id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.status = 'cancelled';
    await booking.save();

    // Free the seat
    if (booking.seat) {
      await Seat.findByIdAndUpdate(booking.seat, {
        status: 'available',
        currentBooking: null,
        currentStudent: null,
      });
    }

    res.json({
      success: true,
      message: `Booking ${booking.bookingId} for seat ${booking.seatNumber} cancelled.`,
    });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
};

// ─── Seat API (JSON for live updates) ──────────────────────────────────────────
const getSeatsApi = async (req, res) => {
  try {
    const seats = await Seat.find().sort({ seatNumber: 1 });
    res.json({ success: true, seats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Student Profile ──────────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.session.studentId).select('-password');
    if (!student) {
      req.session.destroy();
      return res.redirect('/student/login');
    }

    res.render('student/profile', {
      title: 'My Profile',
      student,
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  } catch (err) {
    console.error('Student profile error:', err);
    res.status(500).render('error', { message: 'Failed to load profile', title: 'Error' });
  }
};

// ─── Student Logout ───────────────────────────────────────────────────────────
const postLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.redirect('/student/login');
  });
};

module.exports = {
  getRegister,
  postRegister,
  createPaymentOrder,
  simulateGatewayPayment,
  verifyOnlinePayment,
  getRegistrationSuccess,
  getLogin,
  postLogin,
  getForgotPassword,
  getDashboard,
  getSeatBooking,
  postBookSeat,
  cancelBooking,
  getSeatsApi,
  getProfile,
  postLogout,
};

