const crypto = require('crypto');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('student/login', {
        title: 'Student Login',
        error: 'Email and password are required',
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    const student = await Student.findOne({ email: email.toLowerCase().trim() });
    if (!student) {
      return res.render('student/login', {
        title: 'Student Login',
        error: 'Invalid email or password',
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.render('student/login', {
        title: 'Student Login',
        error: 'Invalid email or password',
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    // Business Rules for Login Access:
    // CASH PENDING:
    if (student.paymentMethod === 'cash' && student.paymentStatus === 'pending') {
      return res.render('student/login', {
        title: 'Student Login',
        error: '⏳ Cash payment pending: Please pay ₹150 at the SR Library desk. Once the admin confirms your cash payment, your account will be activated and login details emailed to you.',
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
        error: '❌ Your registration application was rejected by the library administrator. Please visit or contact the library office.',
        libraryName: process.env.LIBRARY_NAME || 'SR Library',
      });
    }

    // INACTIVE:
    if (student.accountStatus === 'inactive') {
      return res.render('student/login', {
        title: 'Student Login',
        error: '⚠️ Your account has been deactivated. Please contact administration.',
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

// ─── Student Dashboard ────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const student = await Student.findById(req.session.studentId).select('-password');
    if (!student) {
      req.session.destroy();
      return res.redirect('/student/login');
    }

    const payment = await Payment.findOne({ student: student._id });

    res.render('student/dashboard', {
      title: 'Student Dashboard',
      student,
      payment,
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  } catch (err) {
    console.error('Student dashboard error:', err);
    res.status(500).render('error', { message: 'Failed to load dashboard', title: 'Error' });
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
  getDashboard,
  getProfile,
  postLogout,
};
