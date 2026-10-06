const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const jwt = require('jsonwebtoken');
const generateStudentId = require('../utils/generateStudentId');
const { sendStudentIdEmail, sendRejectionEmail } = require('../services/emailService');

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
// ─── Dashboard ───────────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const [
      totalStudents,
      activeStudents,
      pendingCashPayments,
      onlinePayments,
      cashPayments,
      pendingApprovals,
      pendingCashStudents,
      recentStudents,
      totalPaidCount,
    ] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ accountStatus: 'active' }),
      Student.countDocuments({ paymentMethod: 'cash', paymentStatus: 'pending' }),
      Student.countDocuments({ paymentMethod: 'online', paymentStatus: 'paid' }),
      Student.countDocuments({ paymentMethod: 'cash', paymentStatus: 'paid' }),
      Student.countDocuments({ approvalStatus: 'pending' }),
      Student.find({ paymentMethod: 'cash', paymentStatus: 'pending' })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('fullName email mobile studentId createdAt joiningDate paymentMethod paymentStatus approvalStatus accountStatus'),
      Student.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('fullName email mobile studentId createdAt joiningDate paymentMethod paymentStatus approvalStatus accountStatus'),
      Student.countDocuments({ paymentStatus: 'paid' }),
    ]);

    const totalRevenue = totalPaidCount * 150;

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      admin: req.admin,
      stats: {
        totalStudents,
        activeStudents,
        pendingCashPayments,
        onlinePayments,
        cashPayments,
        totalRevenue,
        pendingApprovals,
      },
      pendingCashStudents,
      recentStudents,
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
    const search = req.query.search || '';
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

    const [students, total] = await Promise.all([
      Student.find(query)
        .sort(sortBy)
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
    await student.save();

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

    // Send final approval & activation email
    try {
      await sendStudentIdEmail(student);
      student.emailStatus = 'sent';
      await student.save();
    } catch (emailErr) {
      console.error('Email send failed on cash verification:', emailErr.message);
      student.emailStatus = 'failed';
      await student.save();
    }

    res.json({
      success: true,
      message: `₹150 cash payment received & verified! Account activated for ${student.fullName} (${student.studentId}). Email sent.`,
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

// ─── Deactivate ──────────────────────────────────────────────────────────────
const deactivateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    student.accountStatus = 'inactive';
    await student.save();

    res.json({ success: true, message: 'Student deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Delete ──────────────────────────────────────────────────────────────────
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    await Payment.deleteMany({ student: req.params.id });

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Resend Email ─────────────────────────────────────────────────────────────
const resendEmail = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (!student.studentId) {
      return res.status(400).json({ success: false, message: 'Student ID not yet assigned' });
    }

    await sendStudentIdEmail(student);
    student.emailStatus = 'sent';
    await student.save();

    res.json({ success: true, message: 'Email resent successfully' });
  } catch (err) {
    console.error('Resend email error:', err);
    res.status(500).json({ success: false, message: 'Failed to resend email' });
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
  getStudentDetail,
  assignStudentId,
  markCashPaymentReceived,
  approveStudent,
  rejectStudent,
  deactivateStudent,
  deleteStudent,
  resendEmail,
  getProfile,
};
