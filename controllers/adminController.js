const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const Seat = require('../models/Seat');
const Booking = require('../models/Booking');
const EmailLog = require('../models/EmailLog');
const jwt = require('jsonwebtoken');
const generateStudentId = require('../utils/generateStudentId');
const {
  sendWelcomeEmail,
  sendPaymentConfirmationEmail,
  sendStudentIdEmail,
  sendRejectionEmail,
  retryEmailLog,
  isEmailConfigured,
} = require('../services/emailService');

// ─── Admin Login ────────────────────────────────────────────────────────────
const getLogin = (req, res) => {
  if (req.cookies?.adminToken) {
    try {
      jwt.verify(req.cookies.adminToken, process.env.JWT_SECRET);
      return res.redirect('/admin/dashboard');
    } catch (_) { /* expired */ }
  }
  res.render('admin/login', { error: null, title: 'Admin Login' });
};

const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('admin/login', {
        error: 'Email and password are required',
        title: 'Admin Login',
      });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      return res.render('admin/login', {
        error: 'Invalid email or password',
        title: 'Admin Login',
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.render('admin/login', {
        error: 'Invalid email or password',
        title: 'Admin Login',
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save({ validateBeforeSave: false });

    // Create JWT
    const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
      expiresIn: '8h',
    });

    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Admin login error:', err);
    res.render('admin/login', { error: 'Server error. Please try again.', title: 'Admin Login' });
  }
};

const postLogout = (req, res) => {
  res.clearCookie('adminToken');
  res.redirect('/admin/login');
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const [
      totalStudents,
      activeStudents,
      pendingCashPayments,
      pendingApprovals,
      pendingCashStudents,
      recentStudents,
      paymentAggregation,
      totalSeats,
      availableSeats,
      occupiedSeats,
      maintenanceSeats,
      activeBookings,
      recentBookings,
    ] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ accountStatus: 'active' }),
      Student.countDocuments({ paymentMethod: 'cash', paymentStatus: 'pending' }),
      Student.countDocuments({ approvalStatus: 'pending' }),
      Student.find({ paymentMethod: 'cash', paymentStatus: 'pending' })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('fullName email mobile studentId createdAt joiningDate paymentMethod paymentStatus approvalStatus accountStatus'),
      Student.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('fullName email mobile studentId createdAt joiningDate paymentMethod paymentStatus approvalStatus accountStatus'),
      // Dynamic revenue and payment counts from actual MongoDB Payment records where status = 'paid'
      Payment.aggregate([
        { $match: { status: 'paid' } },
        {
          $group: {
            _id: '$paymentMethod',
            totalRevenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      Seat.countDocuments(),
      Seat.countDocuments({ status: 'available' }),
      Seat.countDocuments({ status: 'occupied' }),
      Seat.countDocuments({ status: 'maintenance' }),
      Booking.countDocuments({ status: 'active' }),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('seat student'),
    ]);

    let onlineRevenue = 0;
    let onlinePayments = 0;
    let cashRevenue = 0;
    let cashPayments = 0;

    paymentAggregation.forEach((item) => {
      if (item._id === 'online') {
        onlineRevenue = item.totalRevenue || 0;
        onlinePayments = item.count || 0;
      } else if (item._id === 'cash') {
        cashRevenue = item.totalRevenue || 0;
        cashPayments = item.count || 0;
      }
    });

    const totalRevenue = onlineRevenue + cashRevenue;
    const totalPaidRegistrations = onlinePayments + cashPayments;

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      admin: req.admin,
      stats: {
        totalStudents,
        activeStudents,
        pendingCashPayments,
        onlinePayments,
        cashPayments,
        onlineRevenue,
        cashRevenue,
        totalRevenue,
        totalPaidCount: totalPaidRegistrations,
        pendingApprovals,
        totalSeats,
        availableSeats,
        occupiedSeats,
        maintenanceSeats,
        activeBookings,
      },
      pendingCashStudents,
      recentStudents,
      recentBookings,
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('error', { message: 'Failed to load dashboard', title: 'Error' });
  }
};

// ─── Student List ────────────────────────────────────────────────────────────
const getStudents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const status = req.query.status || '';
    const method = req.query.method || '';
    const payment = req.query.payment || '';
    const approval = req.query.approval || '';
    const sortBy = req.query.sort || '-createdAt';

    const query = {};

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.accountStatus = status;
    if (method) query.paymentMethod = method;
    if (payment) query.paymentStatus = payment;
    if (approval) query.approvalStatus = approval;

    // Sorting options
    let sortObj = { createdAt: -1 };
    if (sortBy === 'createdAt') sortObj = { createdAt: 1 };
    else if (sortBy === 'fullName') sortObj = { fullName: 1 };
    else if (sortBy === '-fullName') sortObj = { fullName: -1 };
    else if (sortBy === '-joiningDate') sortObj = { joiningDate: -1 };
    else if (sortBy === 'joiningDate') sortObj = { joiningDate: 1 };

    const [students, total] = await Promise.all([
      Student.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .select('-password'),
      Student.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.render('admin/students', {
      title: 'Manage Students',
      admin: req.admin,
      students,
      total,
      page,
      totalPages,
      limit,
      search,
      status,
      method,
      payment,
      approval,
      sortBy,
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).render('error', { message: 'Failed to load students', title: 'Error' });
  }
};

// ─── Student Detail ──────────────────────────────────────────────────────────
const getStudentDetail = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('-password');
    if (!student) {
      return res.status(404).render('error', { message: 'Student not found', title: 'Not Found' });
    }

    const payment = await Payment.findOne({ student: student._id }).populate('cashVerifiedBy', 'name email');

    res.render('admin/student-details', {
      title: `Student - ${student.fullName}`,
      admin: req.admin,
      student,
      payment,
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  } catch (err) {
    console.error('Get student detail error:', err);
    res.status(500).render('error', { message: 'Failed to load student details', title: 'Error' });
  }
};

// ─── Assign Student ID ───────────────────────────────────────────────────────
const assignStudentId = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.paymentStatus !== 'paid') {
      return res.status(400).json({ success: false, message: 'Payment not completed for this student' });
    }

    if (student.studentId) {
      return res.status(400).json({ success: false, message: 'Student ID already assigned' });
    }

    const newStudentId = await generateStudentId();
    student.studentId = newStudentId;
    student.accountStatus = 'active';
    await student.save();

    // Send email
    try {
      await sendStudentIdEmail(student);
      student.emailStatus = 'sent';
      await student.save();
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
      student.emailStatus = 'failed';
      await student.save();
    }

    res.json({
      success: true,
      message: `Student ID ${newStudentId} assigned successfully`,
      studentId: newStudentId,
      emailStatus: student.emailStatus,
    });
  } catch (err) {
    console.error('Assign student ID error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Mark Cash Payment Received ──────────────────────────────────────────────
const markCashPaymentReceived = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.paymentMethod !== 'cash') {
      return res.status(400).json({ success: false, message: 'This student is not registered for cash payment' });
    }

    if (student.paymentStatus === 'paid' && student.accountStatus === 'active') {
      return res.status(400).json({ success: false, message: 'Cash payment has already been verified for this student' });
    }

    // Ensure student has a student ID
    if (!student.studentId) {
      student.studentId = await generateStudentId();
    }

    student.paymentStatus = 'paid';
    student.approvalStatus = 'approved';
    student.accountStatus = 'active';
    await student.save({ validateModifiedOnly: true });

    // Find or create Payment record
    let payment = await Payment.findOne({ student: student._id });
    if (!payment) {
      payment = new Payment({
        student: student._id,
        amount: 150,
        currency: 'INR',
        paymentMethod: 'cash',
      });
    }

    payment.paymentMethod = 'cash';
    payment.status = 'paid';
    payment.amount = 150;
    payment.paymentDate = new Date();
    payment.cashPaymentDate = new Date();
    payment.cashVerifiedBy = req.admin._id;
    payment.cashVerificationNote = req.body?.note || '₹150 cash payment received and verified at library counter';
    await payment.save();

    student.paymentId = payment._id;

    // 1. Automatically trigger Payment Confirmation Email
    try {
      const payEmailResult = await sendPaymentConfirmationEmail(student, payment, { triggerEvent: 'cash_verified' });
      // If student hasn't had their welcome email accepted yet, also trigger/retry welcome email
      const existingWelcome = await EmailLog.findOne({ studentId: student.studentId, emailType: 'welcome', status: 'accepted' });
      if (!existingWelcome) {
        await sendWelcomeEmail(student, { triggerEvent: 'registration', forceResend: true });
      }
      student.emailStatus = payEmailResult.success ? 'sent' : 'failed';
      await student.save({ validateModifiedOnly: true });
    } catch (emailErr) {
      console.error('Email send failed on cash verification:', emailErr.message);
      student.emailStatus = 'failed';
      await student.save({ validateModifiedOnly: true });
    }

    res.json({
      success: true,
      message: `₹150 cash payment received & verified! Account activated for ${student.fullName} (${student.studentId}). Payment confirmation email triggered.`,
      studentId: student.studentId,
      emailStatus: student.emailStatus,
    });
  } catch (err) {
    console.error('Mark cash payment received error:', err);
    res.status(500).json({ success: false, message: 'Server error verifying cash payment' });
  }
};

// ─── Approve Student ───────────────────────────────────────────────────────────
const approveStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Generate Student ID if not present
    if (!student.studentId) {
      student.studentId = await generateStudentId();
    }

    student.paymentStatus = 'paid';
    student.approvalStatus = 'approved';
    student.accountStatus = 'active';
    await student.save();

    // Update or create payment record
    let payment = await Payment.findOne({ student: student._id });
    if (!payment) {
      payment = new Payment({
        student: student._id,
        amount: 150,
        currency: 'INR',
        paymentMethod: student.paymentMethod || 'online',
      });
    }
    payment.status = 'paid';
    payment.paymentDate = new Date();
    if (student.paymentMethod === 'cash') {
      payment.cashPaymentDate = new Date();
      if (req.admin?._id) payment.cashVerifiedBy = req.admin._id;
      payment.cashVerificationNote = payment.cashVerificationNote || 'Approved and verified by admin';
    }
    await payment.save();
    student.paymentId = payment._id;
    await student.save();

    // Send Student ID & Login Details Email
    let emailSent = false;
    try {
      await sendStudentIdEmail(student);
      student.emailStatus = 'sent';
      emailSent = true;
      await student.save();
    } catch (emailErr) {
      console.error('Approval email send failed:', emailErr.message);
      student.emailStatus = 'failed';
      await student.save();
    }

    res.json({
      success: true,
      message: emailSent
        ? `Student approved! Account active and email sent with Student ID (${student.studentId}).`
        : `Student approved! Account active with Student ID (${student.studentId}).`,
      studentId: student.studentId,
      emailStatus: student.emailStatus,
    });
  } catch (err) {
    console.error('Approve student error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Reject Student ────────────────────────────────────────────────────────────
const rejectStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const reason = req.body?.reason || 'Verification requirements not met';
    student.approvalStatus = 'rejected';
    student.accountStatus = 'rejected';
    await student.save();

    try {
      await sendRejectionEmail(student, reason);
    } catch (emailErr) {
      console.error('Rejection email send failed:', emailErr.message);
    }

    res.json({
      success: true,
      message: `Student application has been rejected.`,
    });
  } catch (err) {
    console.error('Reject student error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Activate Student ────────────────────────────────────────────────────────
const activateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found' });
    }

    student.accountStatus = 'active';
    await student.save({ validateModifiedOnly: true });

    res.json({
      success: true,
      message: `Account activated for ${student.fullName}. The student can now log in.`,
      accountStatus: 'active',
    });
  } catch (err) {
    console.error('Activate student error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error activating student' });
  }
};

// ─── Deactivate Student ──────────────────────────────────────────────────────
const deactivateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found' });
    }

    student.accountStatus = 'inactive';
    await student.save({ validateModifiedOnly: true });

    res.json({
      success: true,
      message: `Account deactivated for ${student.fullName}. The student can no longer log in.`,
      accountStatus: 'inactive',
    });
  } catch (err) {
    console.error('Deactivate student error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error deactivating student' });
  }
};

// ─── Delete Student ──────────────────────────────────────────────────────────
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found or already deleted' });
    }

    // Safe Deletion: Free any active seats held by this student
    const activeBookings = await Booking.find({ student: req.params.id, status: 'active' });
    for (const b of activeBookings) {
      if (b.seat) {
        await Seat.findByIdAndUpdate(b.seat, {
          status: 'available',
          currentBooking: null,
          currentStudent: null,
        });
      }
    }

    // Mark bookings as cancelled rather than purging audit history
    await Booking.updateMany(
      { student: req.params.id, status: 'active' },
      { status: 'cancelled', notes: 'Student account deleted by admin' }
    );

    // Keep payment audit history intact with student metadata note
    await Payment.updateMany(
      { student: req.params.id },
      { $set: { cashVerificationNote: 'Account deleted: payment record preserved for audit' } }
    );

    res.json({
      success: true,
      message: `Student "${student.fullName}" (${student.studentId || 'N/A'}) deleted successfully. Seat occupancy freed and financial audit history preserved.`,
    });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error deleting student' });
  }
};

// ─── Print Registration Form ─────────────────────────────────────────────────
const printStudentForm = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('-password');
    if (!student) {
      return res.status(404).render('error', {
        title: 'Student Not Found',
        message: 'Could not find the requested student record to print.',
      });
    }

    const payment = await Payment.findOne({ student: student._id }).populate('cashVerifiedBy', 'name email');

    res.render('admin/print-form', {
      title: `Membership Form - ${student.fullName} (${student.studentId || 'LIB'})`,
      student,
      payment,
      libraryName: process.env.LIBRARY_NAME || 'SR SELF STUDY ZONE & LIBRARY',
    });
  } catch (err) {
    console.error('Print form error:', err);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Failed to generate registration form for printing.',
    });
  }
};

// ─── Payments Dashboard ───────────────────────────────────────────────────────
const getPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    const method = req.query.method || '';
    const status = req.query.status || '';

    const query = {};
    if (method) query.paymentMethod = method;
    if (status) query.status = status;

    const [
      payments,
      total,
      paymentAggregation,
      pendingCashPayments,
    ] = await Promise.all([
      Payment.find(query)
        .populate('student', 'fullName email mobile studentId')
        .populate('cashVerifiedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(query),
      Payment.aggregate([
        { $match: { status: 'paid' } },
        {
          $group: {
            _id: '$paymentMethod',
            totalRevenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      Student.countDocuments({ paymentMethod: 'cash', paymentStatus: 'pending' }),
    ]);

    let onlineRevenue = 0;
    let onlineCount = 0;
    let cashRevenue = 0;
    let cashCount = 0;

    paymentAggregation.forEach((item) => {
      if (item._id === 'online') {
        onlineRevenue = item.totalRevenue || 0;
        onlineCount = item.count || 0;
      } else if (item._id === 'cash') {
        cashRevenue = item.totalRevenue || 0;
        cashCount = item.count || 0;
      }
    });

    const totalRevenue = onlineRevenue + cashRevenue;
    const totalPaidCount = onlineCount + cashCount;
    const totalPages = Math.ceil(total / limit);

    res.render('admin/payments', {
      title: 'Payment Dashboard & Records',
      admin: req.admin,
      payments,
      total,
      page,
      totalPages,
      limit,
      method,
      status,
      stats: {
        totalRevenue,
        onlineRevenue,
        cashRevenue,
        pendingCashPayments,
        totalPaidCount,
        onlineCount,
        cashCount,
      },
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load payments' });
  }
};

// ─── Resend Email ─────────────────────────────────────────────────────────────
const resendEmail = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (!student.studentId) {
      student.studentId = await generateStudentId();
      await student.save();
    }

    const emailResult = await sendWelcomeEmail(student, { triggerEvent: 'admin_resend', forceResend: true });
    if (emailResult && emailResult.notConfigured) {
      student.emailStatus = 'failed';
      await student.save({ validateModifiedOnly: true });
      return res.status(503).json({
        success: false,
        notConfigured: true,
        message: 'SMTP email service is not configured in .env (EMAIL_USER / EMAIL_PASSWORD). Please configure valid credentials to send real emails.',
      });
    }

    if (!emailResult.success) {
      student.emailStatus = 'failed';
      await student.save({ validateModifiedOnly: true });
      return res.status(500).json({
        success: false,
        message: emailResult.message || 'Email sending failed',
      });
    }

    student.emailStatus = 'sent';
    await student.save({ validateModifiedOnly: true });

    res.json({ success: true, message: `Welcome email sent successfully to ${student.email}` });
  } catch (err) {
    console.error('Resend email error:', err);
    res.status(500).json({ success: false, message: 'Failed to resend email: ' + err.message });
  }
};

// ─── Get Student JSON (for Edit Modals) ──────────────────────────────────────
const getStudentJson = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('-password');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, student });
  } catch (err) {
    console.error('getStudentJson error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error fetching student details' });
  }
};

// ─── Edit Student (Admin) ─────────────────────────────────────────────────────
const updateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const body = req.body;

    // 1. Validate required fields
    if (!body.fullName || !body.fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }
    if (!body.parentName || !body.parentName.trim()) {
      return res.status(400).json({ success: false, message: "Father's/Mother's name is required." });
    }
    if (!body.mobile || !body.mobile.trim()) {
      return res.status(400).json({ success: false, message: 'Mobile number is required.' });
    }
    if (!body.email || !body.email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    // 2. Validate format: 10-digit mobile
    const cleanedMobile = body.mobile.trim().replace(/\D/g, '');
    if (cleanedMobile.length !== 10) {
      return res.status(400).json({ success: false, message: 'Mobile number must be exactly 10 digits.' });
    }

    // 3. Validate format: email
    const cleanedEmail = body.email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // 4. Check duplicate email (excluding this student)
    if (cleanedEmail !== student.email) {
      const dupEmail = await Student.findOne({ email: cleanedEmail, _id: { $ne: student._id } });
      if (dupEmail) {
        return res.status(400).json({
          success: false,
          message: `The email "${cleanedEmail}" is already in use by student ${dupEmail.studentId || dupEmail.fullName}.`,
        });
      }
    }

    // 5. Check duplicate mobile (excluding this student)
    if (cleanedMobile !== student.mobile) {
      const dupMobile = await Student.findOne({ mobile: cleanedMobile, _id: { $ne: student._id } });
      if (dupMobile) {
        return res.status(400).json({
          success: false,
          message: `The mobile number "${cleanedMobile}" is already in use by student ${dupMobile.studentId || dupMobile.fullName}.`,
        });
      }
    }

    // 6. Update permitted registration details only
    student.fullName = body.fullName.trim();
    student.parentName = body.parentName.trim();
    student.mobile = cleanedMobile;
    student.email = cleanedEmail;

    if (body.dateOfBirth) student.dateOfBirth = new Date(body.dateOfBirth);
    if (body.gender && ['male', 'female', 'other'].includes(body.gender)) student.gender = body.gender;
    if (body.address) student.address = body.address.trim();
    if (body.emergencyContact !== undefined) student.emergencyContact = body.emergencyContact.trim();
    if (body.idProofType) student.idProofType = body.idProofType.trim();
    if (body.idProofNumber !== undefined) student.idProofNumber = body.idProofNumber.trim();
    if (body.educationLevel) student.educationLevel = body.educationLevel.trim();
    if (body.preparingFor) student.preparingFor = body.preparingFor.trim();
    if (body.membershipSlot) student.membershipSlot = body.membershipSlot.trim();
    if (body.subscriptionPlan) student.subscriptionPlan = body.subscriptionPlan.trim();
    if (body.slotTiming) {
      student.slotTiming = body.slotTiming.trim();
    } else if (!student.slotTiming) {
      student.slotTiming = '6:00 AM - 10:00 PM (Full Day)';
    }
    if (body.joiningDate) student.joiningDate = new Date(body.joiningDate);

    // Keep Student ID, paymentStatus, approvalStatus, accountStatus strictly untouched here!

    await student.save();

    // Sync student name, mobile, email in active Booking documents
    try {
      await Booking.updateMany(
        { student: student._id },
        {
          studentName: student.fullName,
          studentMobile: student.mobile,
          studentEmail: student.email,
        }
      );
    } catch (_) {}

    res.json({
      success: true,
      message: `Student details for "${student.fullName}" updated successfully!`,
      student,
    });
  } catch (err) {
    console.error('Update student error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error updating student details' });
  }
};

// ─── Email Notifications Monitoring & Logs ──────────────────────────────────
const getEmailLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const status = req.query.status || '';
    const emailType = req.query.type || '';

    const query = {};
    if (status) query.status = status;
    if (emailType) query.emailType = emailType;
    if (search) {
      query.$or = [
        { recipientEmail: { $regex: search, $options: 'i' } },
        { recipientName: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
      ];
    }

    const [logs, total, totalAccepted, totalFailed, totalSending, totalQueued] = await Promise.all([
      EmailLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('student', 'fullName studentId email mobile'),
      EmailLog.countDocuments(query),
      EmailLog.countDocuments({ status: 'accepted' }),
      EmailLog.countDocuments({ status: 'failed' }),
      EmailLog.countDocuments({ status: 'sending' }),
      EmailLog.countDocuments({ status: 'queued' }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.render('admin/emails', {
      title: 'Email Notifications & Logs',
      admin: req.admin,
      logs,
      total,
      page,
      totalPages,
      limit,
      search,
      status,
      emailType,
      stats: {
        totalEmails: await EmailLog.countDocuments(),
        totalAccepted,
        totalFailed,
        totalSending,
        totalQueued,
      },
      isConfigured: isEmailConfigured(),
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  } catch (err) {
    console.error('Get email logs error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load email notification logs' });
  }
};

// ─── Retry Email Sending ──────────────────────────────────────────────────────
const retryEmail = async (req, res) => {
  try {
    const logId = req.params.id;
    const result = await retryEmailLog(logId);
    res.json(result);
  } catch (err) {
    console.error('Retry email error:', err);
    res.status(500).json({ success: false, message: 'Server error retrying email: ' + err.message });
  }
};

// ─── Seat Management ─────────────────────────────────────────────────────────
const getSeats = async (req, res) => {
  try {
    const [seats, totalSeats, availableSeats, occupiedSeats, lockedSeats, activeStudents] = await Promise.all([
      Seat.find()
        .sort({ seatNumber: 1 })
        .populate({
          path: 'currentBooking',
          select: 'bookingId studentName studentMobile studentEmail bookingDate slot plan status',
        })
        .populate('currentStudent', 'fullName studentId mobile email'),
      Seat.countDocuments(),
      Seat.countDocuments({ status: 'available' }),
      Seat.countDocuments({ status: 'occupied' }),
      Seat.countDocuments({ status: { $in: ['maintenance', 'locked'] } }),
      Student.find({ accountStatus: 'active' }).select('fullName studentId mobile email').sort({ fullName: 1 }),
    ]);

    res.render('admin/seats', {
      title: 'Seat Management',
      admin: req.admin,
      seats,
      activeStudents: activeStudents || [],
      stats: {
        totalSeats,
        availableSeats,
        occupiedSeats,
        maintenanceSeats: lockedSeats,
      },
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  } catch (err) {
    console.error('Get seats error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load seats management' });
  }
};

// ─── Update Seat Status & Reassign ────────────────────────────────────────────
const updateSeatStatus = async (req, res) => {
  try {
    const { status, notes, reassignStudentId } = req.body;
    const seat = await Seat.findById(req.params.id);
    if (!seat) return res.status(404).json({ success: false, message: 'Seat not found' });

    // Handle Direct Admin Seat Reassignment
    if (reassignStudentId) {
      let student = null;
      if (reassignStudentId.match(/^[0-9a-fA-F]{24}$/)) {
        student = await Student.findById(reassignStudentId);
      }
      if (!student) {
        student = await Student.findOne({ studentId: reassignStudentId.toUpperCase().trim() });
      }

      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found for reassignment' });
      }

      // Free previous seat held by this student if any
      const previousBooking = await Booking.findOne({ student: student._id, status: 'active' });
      if (previousBooking && String(previousBooking.seat) !== String(seat._id)) {
        previousBooking.status = 'completed';
        await previousBooking.save();
        await Seat.findByIdAndUpdate(previousBooking.seat, {
          status: 'available',
          currentBooking: null,
          currentStudent: null,
        });
      }

      // Free previous occupant of this desk if any
      if (seat.currentBooking && String(seat.currentStudent) !== String(student._id)) {
        await Booking.findByIdAndUpdate(seat.currentBooking, { status: 'completed' });
      }

      const bookingCode = 'BK' + Date.now().toString().slice(-6) + Math.random().toString(36).substring(2, 5).toUpperCase();
      const booking = new Booking({
        bookingId: bookingCode,
        student: student._id,
        studentName: student.fullName,
        studentMobile: student.mobile,
        studentEmail: student.email,
        seat: seat._id,
        seatNumber: seat.seatNumber,
        bookingDate: new Date(),
        slot: student.membershipSlot || 'Full Day (6:00 AM - 11:00 PM)',
        plan: student.subscriptionPlan || 'Monthly Membership',
        status: 'active',
        notes: notes || 'Assigned / corrected by Admin',
      });
      await booking.save();

      seat.status = 'occupied';
      seat.currentBooking = booking._id;
      seat.currentStudent = student._id;
      await seat.save();

      return res.json({
        success: true,
        message: `Seat ${seat.seatNumber} successfully reassigned to ${student.fullName} (${student.studentId}).`,
        seatNumber: seat.seatNumber,
        status: seat.status,
      });
    }

    // Status change (available, locked, maintenance)
    seat.status = status;
    if (status === 'available' || status === 'locked' || status === 'maintenance') {
      if (seat.currentBooking) {
        await Booking.findByIdAndUpdate(seat.currentBooking, { status: 'completed' });
      }
      seat.currentBooking = null;
      seat.currentStudent = null;
    }

    await seat.save();

    res.json({
      success: true,
      message: `Seat ${seat.seatNumber} status updated to ${status}.`,
      seatNumber: seat.seatNumber,
      status: seat.status,
    });
  } catch (err) {
    console.error('Update seat status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update seat status: ' + err.message });
  }
};

// ─── Booking Management ───────────────────────────────────────────────────────
const getBookings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const status = req.query.status || '';
    const date = req.query.date || '';

    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { studentMobile: { $regex: search, $options: 'i' } },
        { seatNumber: { $regex: search, $options: 'i' } },
        { bookingId: { $regex: search, $options: 'i' } },
      ];
    }
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.bookingDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const [bookings, total, totalActive, totalCompleted, totalCancelled] = await Promise.all([
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('seat student'),
      Booking.countDocuments(query),
      Booking.countDocuments({ status: 'active' }),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ status: 'cancelled' }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.render('admin/bookings', {
      title: 'Booking Management',
      admin: req.admin,
      bookings,
      total,
      page,
      totalPages,
      limit,
      search,
      status,
      date,
      stats: {
        totalActive,
        totalCompleted,
        totalCancelled,
      },
      libraryName: process.env.LIBRARY_NAME || 'SR Library',
    });
  } catch (err) {
    console.error('Get bookings error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load bookings' });
  }
};

// ─── Cancel Booking (Admin) ───────────────────────────────────────────────────
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.status = 'cancelled';
    await booking.save();

    // Free up seat
    if (booking.seat) {
      await Seat.findByIdAndUpdate(booking.seat, {
        status: 'available',
        currentBooking: null,
        currentStudent: null,
      });
    }

    res.json({
      success: true,
      message: `Booking ${booking.bookingId} cancelled and seat ${booking.seatNumber} is now available.`,
    });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
};

// ─── Seats API (JSON for Admin) ───────────────────────────────────────────────
const getSeatsApi = async (req, res) => {
  try {
    const seats = await Seat.find().sort({ seatNumber: 1 });
    res.json({ success: true, seats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Admin Profile ────────────────────────────────────────────────────────────
const getProfile = (req, res) => {
  res.render('admin/profile', {
    title: 'Admin Profile',
    admin: req.admin,
    libraryName: process.env.LIBRARY_NAME || 'SR Library',
  });
};

module.exports = {
  getLogin,
  postLogin,
  postLogout,
  getDashboard,
  getStudents,
  getPayments,
  getStudentDetail,
  printStudentForm,
  assignStudentId,
  markCashPaymentReceived,
  approveStudent,
  rejectStudent,
  activateStudent,
  deactivateStudent,
  deleteStudent,
  resendEmail,
  updateStudent,
  getStudentJson,
  getEmailLogs,
  retryEmail,
  getSeats,
  updateSeatStatus,
  getBookings,
  cancelBooking,
  getSeatsApi,
  getProfile,
};
