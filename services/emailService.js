const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');

const isEmailConfigured = () => {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '').trim();
  return (
    user.length > 0 &&
    user !== 'your_email@gmail.com' &&
    pass.length > 0 &&
    pass !== 'your_gmail_app_password'
  );
};

const getSenderAddress = () => {
  const libraryName = process.env.LIBRARY_NAME || 'SR Library';
  const emailUser = (process.env.EMAIL_USER || 'srselfstudyzone@gmail.com').trim();
  const fromName = (process.env.EMAIL_FROM_NAME || `${libraryName} Management`).trim();

  if (process.env.EMAIL_FROM && process.env.EMAIL_FROM.includes('@')) {
    if (process.env.EMAIL_FROM.includes('<')) {
      return process.env.EMAIL_FROM.trim();
    }
    return `"${fromName}" <${process.env.EMAIL_FROM.trim()}>`;
  }
  return `"${fromName}" <${emailUser}>`;
};

const getReplyToAddress = () => {
  return (process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER || 'srselfstudyzone@gmail.com').trim();
};

const createTransporter = () => {
  const host = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const isSecure = port === 465 || process.env.EMAIL_SECURE === 'true';
  const user = (process.env.EMAIL_USER || '').trim();
  // Strip any spaces if the user copied Google App Password formatted with spaces (e.g. "abcd efgh ijkl mnop")
  const pass = (process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '').trim();

  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: isSecure, // true for 465 (SSL), false for 587 (STARTTLS)
    requireTLS: !isSecure, // Explicitly enforce STARTTLS negotiation on port 587
    auth: {
      user: user,
      pass: pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
};

/**
 * Format date helper
 */
const formatDate = (d) => {
  try {
    return new Date(d || Date.now()).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch (_) {
    return new Date().toLocaleDateString('en-IN');
  }
};

/**
 * 1. AUTOMATIC WELCOME & STUDENT ID EMAIL
 * Sends the welcome email automatically after registration.
 */
const sendWelcomeEmail = async (student, options = {}) => {
  const triggerEvent = options.triggerEvent || 'registration';
  const forceResend = Boolean(options.forceResend);
  const libraryName = process.env.LIBRARY_NAME || 'SR Library';

  if (!student || !student.email) {
    return { success: false, message: 'Invalid student or missing email address.' };
  }

  // Idempotency / Duplicate Prevention:
  // If not forcing resend, check if an accepted welcome email exists in last 24h, or was attempted in last 2 minutes
  if (!forceResend) {
    const existingSent = await EmailLog.findOne({
      studentId: student.studentId,
      emailType: 'welcome',
      $or: [
        { status: { $in: ['accepted', 'sending', 'queued'] } },
        { createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) } },
      ],
    });

    if (existingSent) {
      console.log(`ℹ️ [EmailService] Welcome email already accepted or recently attempted for ${student.studentId} (${student.email}). Skipping duplicate.`);
      return {
        success: true,
        duplicatePrevented: true,
        message: 'Welcome email was already sent or recently attempted for this recipient.',
        emailLogId: existingSent._id,
      };
    }
  }

  const subject = `Welcome to ${libraryName} | Your Student ID`;
  const regDateStr = formatDate(student.registrationDate || student.createdAt);
  const isPaid = student.paymentStatus === 'paid';
  const paymentStatusText = isPaid ? 'Paid' : (student.paymentMethod === 'cash' ? 'Pending Cash Payment (₹150)' : 'Pending Online Payment (₹150)');
  const accountStatusText = student.accountStatus === 'active' ? 'Active & Approved' : (student.accountStatus === 'inactive' ? 'Inactive' : 'Pending Approval');

  // Create EmailLog entry
  const emailLog = new EmailLog({
    student: student._id,
    studentId: student.studentId || '',
    recipientEmail: student.email.toLowerCase().trim(),
    recipientName: student.fullName || 'Student',
    emailType: 'welcome',
    triggerEvent,
    subject,
    status: 'sending',
    attemptCount: 1,
    lastAttemptAt: new Date(),
    meta: {
      paymentStatus: student.paymentStatus,
      paymentMethod: student.paymentMethod,
      accountStatus: student.accountStatus,
    },
  });
  await emailLog.save();

  // Plain-text alternative (matches user requirement exactly)
  const plainText = `Hello ${student.fullName},

Congratulations! Your registration at ${libraryName} has been completed successfully.

Welcome to ${libraryName}! We are happy to have you as a member of our study community.

Your Registration Details
Student Name: ${student.fullName}
Student ID: ${student.studentId}
Registration Date: ${regDateStr}
Payment Status: ${paymentStatusText}
Account Status: ${accountStatusText}

Please keep your Student ID safe for future reference.

You can log in to your student portal to view your membership information and book an available study seat.

We look forward to supporting your learning journey and helping you maintain a productive study routine.

For any assistance, please contact the ${libraryName} team using the official contact details on our website (+91 8103485288 / srselfstudyzone@gmail.com).

Warm regards,
${libraryName} Team
`;

  // HTML Template
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
  <style>
    body { margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#0f172a; line-height:1.6; }
    .email-container { max-width:600px; margin:24px auto; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 8px 30px rgba(15,23,42,0.08); }
    .email-header { background:linear-gradient(135deg, #0d1b6e 0%, #1a237e 60%, #283593 100%); padding:36px 30px; text-align:center; color:#ffffff; }
    .email-header h1 { margin:0; font-size:24px; font-weight:800; letter-spacing:-0.02em; }
    .email-header p { margin:8px 0 0; color:#ffd600; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
    .email-body { padding:32px 30px; }
    .greeting { font-size:18px; font-weight:700; color:#0f172a; margin-bottom:14px; }
    .intro-text { font-size:15px; color:#334155; margin-bottom:20px; line-height:1.65; }
    .id-box { background:linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%); border:2px solid #3b82f6; border-radius:12px; padding:20px; text-align:center; margin:24px 0; }
    .id-box-label { font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#1d4ed8; font-weight:700; margin-bottom:4px; }
    .id-box-value { font-size:32px; font-weight:800; color:#1e1b4b; font-family:Consolas, Monaco, monospace; letter-spacing:2px; }
    .details-table-title { font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#475569; margin:24px 0 10px; border-bottom:2px solid #e2e8f0; padding-bottom:6px; }
    .details-table { width:100%; border-collapse:collapse; margin-bottom:22px; }
    .details-table td { padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:14px; }
    .details-table td.label { width:42%; color:#64748b; font-weight:600; }
    .details-table td.value { color:#0f172a; font-weight:700; }
    .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; }
    .badge-paid { background:#dcfce7; color:#15803d; }
    .badge-pending { background:#fef3c7; color:#b45309; }
    .callout-box { background:#f8fafc; border-left:4px solid #1a237e; padding:14px 18px; border-radius:6px; margin:22px 0; font-size:14px; color:#334155; }
    .email-footer { background:#f8fafc; padding:24px 30px; text-align:center; border-top:1px solid #e2e8f0; color:#64748b; font-size:12.5px; }
    .email-footer strong { color:#1e293b; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>${libraryName}</h1>
      <p>Official Registration Confirmation</p>
    </div>

    <div class="email-body">
      <div class="greeting">Hello ${student.fullName},</div>
      
      <p class="intro-text">
        Congratulations! Your registration at <strong>${libraryName}</strong> has been completed successfully.
      </p>

      <p class="intro-text">
        Welcome to ${libraryName}! We are happy to have you as a member of our study community.
      </p>

      <div class="id-box">
        <div class="id-box-label">Your Official Student ID</div>
        <div class="id-box-value">${student.studentId}</div>
      </div>

      <div class="details-table-title">Your Registration Details</div>
      <table class="details-table">
        <tr>
          <td class="label">Student Name:</td>
          <td class="value">${student.fullName}</td>
        </tr>
        <tr>
          <td class="label">Student ID:</td>
          <td class="value" style="font-family:monospace;color:#1e293b;">${student.studentId}</td>
        </tr>
        <tr>
          <td class="label">Registration Date:</td>
          <td class="value">${regDateStr}</td>
        </tr>
        <tr>
          <td class="label">Payment Status:</td>
          <td class="value">
            <span class="badge ${isPaid ? 'badge-paid' : 'badge-pending'}">${paymentStatusText}</span>
          </td>
        </tr>
        <tr>
          <td class="label">Account Status:</td>
          <td class="value">
            <span class="badge ${student.accountStatus === 'active' ? 'badge-paid' : 'badge-pending'}">${accountStatusText}</span>
          </td>
        </tr>
      </table>

      <div class="callout-box">
        <strong>Important:</strong> Please keep your Student ID safe for future reference.
        <br/>
        You can log in to your student portal to view your membership information and book an available study seat.
      </div>

      <p class="intro-text">
        We look forward to supporting your learning journey and helping you maintain a productive study routine.
      </p>

      <p class="intro-text">
        For any assistance, please contact the ${libraryName} team using the official contact details on our website (+91 8103485288 / srselfstudyzone@gmail.com).
      </p>

      <p style="margin-top:28px;font-size:15px;color:#0f172a;">
        Warm regards,<br/>
        <strong>${libraryName} Team</strong>
      </p>
    </div>

    <div class="email-footer">
      <p><strong>${libraryName} Self Study Zone</strong></p>
      <p>Shahdol, Madhya Pradesh • Open Daily 6:00 AM – 11:00 PM</p>
      <p style="margin-top:8px;font-size:11.5px;color:#94a3b8;">
        This automated notification was generated by the library management system.
      </p>
    </div>
  </div>
</body>
</html>
`;

  // If SMTP is not configured in .env, record truthful failure
  if (!isEmailConfigured()) {
    const errorMsg = 'SMTP credentials not configured in .env (EMAIL_USER / EMAIL_PASSWORD). Set up Gmail App Password to enable live email sending.';
    console.warn(`⚠️ [EmailService] ${errorMsg}`);
    emailLog.status = 'failed';
    emailLog.errorInfo = errorMsg;
    await emailLog.save();

    return {
      success: false,
      notConfigured: true,
      emailLogId: emailLog._id,
      message: errorMsg,
    };
  }

  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: getSenderAddress(),
      to: student.email,
      replyTo: getReplyToAddress(),
      subject,
      text: plainText,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ [EmailService] Welcome email accepted by provider for ${student.email} (MessageId: ${info.messageId})`);

    emailLog.status = 'accepted';
    emailLog.messageId = info.messageId || 'accepted-by-smtp';
    emailLog.errorInfo = null;
    await emailLog.save();

    return {
      success: true,
      messageId: info.messageId,
      emailLogId: emailLog._id,
      message: `Welcome email accepted by provider for ${student.email}`,
    };
  } catch (err) {
    console.error(`❌ [EmailService] Welcome email failed for ${student.email}:`, err.message);
    emailLog.status = 'failed';
    emailLog.errorInfo = err.message;
    await emailLog.save();

    return {
      success: false,
      error: err.message,
      emailLogId: emailLog._id,
      message: `Email sending failed: ${err.message}`,
    };
  }
};

/**
 * 2. AUTOMATIC PAYMENT CONFIRMATION EMAIL
 * Triggered automatically when payment is recorded as PAID.
 */
const sendPaymentConfirmationEmail = async (student, payment, options = {}) => {
  const triggerEvent = options.triggerEvent || (payment.paymentMethod === 'cash' ? 'cash_verified' : 'online_payment');
  const forceResend = Boolean(options.forceResend);
  const libraryName = process.env.LIBRARY_NAME || 'SR Library';

  if (!student || !student.email) {
    return { success: false, message: 'Invalid student or missing email address.' };
  }

  // Idempotency check: Do not send duplicate payment emails for the same payment record
  if (!forceResend && payment && payment._id) {
    const existingSent = await EmailLog.findOne({
      recipientEmail: student.email.toLowerCase().trim(),
      emailType: 'payment_confirmation',
      'meta.paymentId': String(payment._id),
      $or: [
        { status: { $in: ['accepted', 'sending', 'queued'] } },
        { createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) } },
      ],
    });

    if (existingSent) {
      console.log(`ℹ️ [EmailService] Payment confirmation already accepted or recently attempted for payment ${payment._id}. Skipping duplicate.`);
      return {
        success: true,
        duplicatePrevented: true,
        message: 'Payment confirmation was already sent or recently attempted for this transaction.',
        emailLogId: existingSent._id,
      };
    }
  }

  const subject = `Payment Confirmation — ${libraryName}`;
  const amountStr = `₹${payment.amount || 150}`;
  const methodStr = payment.paymentMethod === 'cash' ? 'Cash at Library Desk' : 'Online (Gateway / UPI)';
  const payDateStr = formatDate(payment.paymentDate || payment.cashPaymentDate || Date.now());
  const refStr = payment.paymentId || payment.orderId || payment.razorpayPaymentId || `RCPT-${Date.now().toString().slice(-6)}`;

  // Create EmailLog entry
  const emailLog = new EmailLog({
    student: student._id,
    studentId: student.studentId || '',
    recipientEmail: student.email.toLowerCase().trim(),
    recipientName: student.fullName || 'Student',
    emailType: 'payment_confirmation',
    triggerEvent,
    subject,
    status: 'sending',
    attemptCount: 1,
    lastAttemptAt: new Date(),
    meta: {
      paymentId: payment._id ? String(payment._id) : null,
      amount: payment.amount || 150,
      paymentMethod: payment.paymentMethod,
      reference: refStr,
    },
  });
  await emailLog.save();

  // Plain-text alternative
  const plainText = `Hello ${student.fullName},

Your payment for ${libraryName} has been successfully confirmed.

Payment Details:
Student Name: ${student.fullName}
Student ID: ${student.studentId}
Amount Paid: ${amountStr}
Payment Method: ${methodStr}
Payment Date: ${payDateStr}
Transaction/Receipt Reference: ${refStr}

Thank you for choosing ${libraryName}.

Please log in to your student account to view your membership and booking details.

Regards,
${libraryName} Team
`;

  // HTML Template
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
  <style>
    body { margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#0f172a; line-height:1.6; }
    .email-container { max-width:600px; margin:24px auto; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 8px 30px rgba(15,23,42,0.08); }
    .email-header { background:linear-gradient(135deg, #15803d 0%, #166534 100%); padding:32px 30px; text-align:center; color:#ffffff; }
    .email-header h1 { margin:0; font-size:23px; font-weight:800; }
    .email-header p { margin:6px 0 0; color:#bbf7d0; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:1px; }
    .email-body { padding:32px 30px; }
    .amount-highlight { font-size:38px; font-weight:800; color:#15803d; text-align:center; margin:16px 0; font-family:var(--font-display, inherit); }
    .status-pill { display:inline-block; background:#dcfce7; color:#166534; font-size:12px; font-weight:700; padding:4px 14px; border-radius:20px; }
    .details-table-title { font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#475569; margin:24px 0 10px; border-bottom:2px solid #e2e8f0; padding-bottom:6px; }
    .details-table { width:100%; border-collapse:collapse; margin-bottom:22px; }
    .details-table td { padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:14px; }
    .details-table td.label { width:45%; color:#64748b; font-weight:600; }
    .details-table td.value { color:#0f172a; font-weight:700; }
    .email-footer { background:#f8fafc; padding:22px 30px; text-align:center; border-top:1px solid #e2e8f0; color:#64748b; font-size:12px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Payment Received</h1>
      <p>${libraryName}</p>
    </div>

    <div class="email-body">
      <p style="font-size:17px;font-weight:700;margin-top:0;">Hello ${student.fullName},</p>
      
      <p style="font-size:15px;color:#334155;">
        Your payment for <strong>${libraryName}</strong> has been successfully confirmed.
      </p>

      <div style="text-align:center;margin:20px 0;">
        <span class="status-pill">✓ PAYMENT CONFIRMED</span>
        <div class="amount-highlight">${amountStr}</div>
      </div>

      <div class="details-table-title">Payment Details</div>
      <table class="details-table">
        <tr>
          <td class="label">Student Name:</td>
          <td class="value">${student.fullName}</td>
        </tr>
        <tr>
          <td class="label">Student ID:</td>
          <td class="value" style="font-family:monospace;">${student.studentId}</td>
        </tr>
        <tr>
          <td class="label">Amount Paid:</td>
          <td class="value" style="color:#15803d;">${amountStr}</td>
        </tr>
        <tr>
          <td class="label">Payment Method:</td>
          <td class="value">${methodStr}</td>
        </tr>
        <tr>
          <td class="label">Payment Date:</td>
          <td class="value">${payDateStr}</td>
        </tr>
        <tr>
          <td class="label">Transaction/Receipt Reference:</td>
          <td class="value" style="font-family:monospace;font-size:12.5px;">${refStr}</td>
        </tr>
      </table>

      <p style="font-size:15px;color:#334155;margin-top:20px;">
        Thank you for choosing ${libraryName}.
      </p>

      <p style="font-size:15px;color:#334155;">
        Please log in to your student account to view your membership and booking details.
      </p>

      <p style="margin-top:28px;font-size:15px;color:#0f172a;">
        Regards,<br/>
        <strong>${libraryName} Team</strong>
      </p>
    </div>

    <div class="email-footer">
      <p><strong>${libraryName} Self Study Zone</strong> • Official Payment Receipt</p>
      <p style="margin-top:4px;">Shahdol, Madhya Pradesh • Open Daily 6:00 AM – 11:00 PM</p>
    </div>
  </div>
</body>
</html>
`;

  // If SMTP is not configured in .env, record failure
  if (!isEmailConfigured()) {
    const errorMsg = 'SMTP credentials not configured in .env (EMAIL_USER / EMAIL_PASSWORD). Set up Gmail App Password to enable live delivery.';
    console.warn(`⚠️ [EmailService] ${errorMsg}`);
    emailLog.status = 'failed';
    emailLog.errorInfo = errorMsg;
    await emailLog.save();

    return {
      success: false,
      notConfigured: true,
      emailLogId: emailLog._id,
      message: errorMsg,
    };
  }

  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: getSenderAddress(),
      to: student.email,
      replyTo: getReplyToAddress(),
      subject,
      text: plainText,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ [EmailService] Payment confirmation accepted for ${student.email} (MessageId: ${info.messageId})`);

    emailLog.status = 'accepted';
    emailLog.messageId = info.messageId || 'accepted-by-smtp';
    emailLog.errorInfo = null;
    await emailLog.save();

    return {
      success: true,
      messageId: info.messageId,
      emailLogId: emailLog._id,
      message: `Payment confirmation accepted by provider for ${student.email}`,
    };
  } catch (err) {
    console.error(`❌ [EmailService] Payment email failed for ${student.email}:`, err.message);
    emailLog.status = 'failed';
    emailLog.errorInfo = err.message;
    await emailLog.save();

    return {
      success: false,
      error: err.message,
      emailLogId: emailLog._id,
      message: `Email sending failed: ${err.message}`,
    };
  }
};

/**
 * 3. RETRY EMAIL LOG
 * Allows the admin to retry sending any failed email from the Email Notifications log.
 */
const retryEmailLog = async (logId) => {
  const log = await EmailLog.findById(logId).populate('student');
  if (!log) {
    return { success: false, message: 'Email log not found.' };
  }

  log.attemptCount += 1;
  log.lastAttemptAt = new Date();
  log.status = 'sending';
  await log.save();

  if (log.emailType === 'welcome' && log.student) {
    const result = await sendWelcomeEmail(log.student, { triggerEvent: 'retry', forceResend: true });
    log.status = result.success ? 'accepted' : 'failed';
    log.errorInfo = result.success ? null : (result.message || result.error || 'Retry delivery failed');
    if (result.messageId) log.messageId = result.messageId;
    await log.save();
    return result;
  }

  if (log.emailType === 'payment_confirmation' && log.student) {
    const Payment = require('../models/Payment');
    let payment = null;
    if (log.meta && log.meta.paymentId) {
      payment = await Payment.findById(log.meta.paymentId);
    }
    if (!payment) {
      payment = await Payment.findOne({ student: log.student._id }).sort({ createdAt: -1 });
    }
    if (payment) {
      const result = await sendPaymentConfirmationEmail(log.student, payment, { triggerEvent: 'retry', forceResend: true });
      log.status = result.success ? 'accepted' : 'failed';
      log.errorInfo = result.success ? null : (result.message || result.error || 'Retry delivery failed');
      if (result.messageId) log.messageId = result.messageId;
      await log.save();
      return result;
    }
  }

  // Generic fallback if student ref exists
  if (!isEmailConfigured()) {
    log.status = 'failed';
    log.errorInfo = 'SMTP credentials not configured in .env';
    await log.save();
    return { success: false, notConfigured: true, message: 'SMTP not configured in .env' };
  }

  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: getSenderAddress(),
      to: log.recipientEmail,
      replyTo: getReplyToAddress(),
      subject: log.subject,
      text: `Notification from ${process.env.LIBRARY_NAME || 'SR Library'} regarding ${log.emailType}.`,
    };

    const info = await transporter.sendMail(mailOptions);
    log.status = 'accepted';
    log.messageId = info.messageId;
    log.errorInfo = null;
    await log.save();

    return { success: true, message: `Email retry succeeded for ${log.recipientEmail}` };
  } catch (err) {
    log.status = 'failed';
    log.errorInfo = err.message;
    await log.save();
    return { success: false, error: err.message, message: `Retry failed: ${err.message}` };
  }
};

/**
 * Legacy wrapper: sendStudentIdEmail -> sendWelcomeEmail
 */
const sendStudentIdEmail = async (student) => {
  return await sendWelcomeEmail(student, { triggerEvent: 'admin_resend', forceResend: true });
};

/**
 * Rejection email
 */
const sendRejectionEmail = async (student, reason = '') => {
  const libraryName = process.env.LIBRARY_NAME || 'SR Library';
  const subject = `Registration Application Update — ${libraryName}`;

  const emailLog = new EmailLog({
    student: student._id,
    studentId: student.studentId || '',
    recipientEmail: student.email.toLowerCase().trim(),
    recipientName: student.fullName || 'Student',
    emailType: 'rejection',
    triggerEvent: 'admin_manual',
    subject,
    status: 'sending',
    attemptCount: 1,
    lastAttemptAt: new Date(),
    meta: { reason },
  });
  await emailLog.save();

  if (!isEmailConfigured()) {
    emailLog.status = 'failed';
    emailLog.errorInfo = 'SMTP not configured in .env';
    await emailLog.save();
    return { success: false, notConfigured: true };
  }

  try {
    const transporter = createTransporter();
    const htmlContent = `
      <div style="font-family:sans-serif;max-width:550px;margin:20px auto;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
        <h2 style="color:#b91c1c;">Application Update — ${libraryName}</h2>
        <p>Dear <strong>${student.fullName}</strong>,</p>
        <p>Your registration application could not be approved at this time.</p>
        <p style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px;">${reason || 'Application did not meet verification criteria.'}</p>
        <p>Please visit the library reception desk for assistance.</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: getSenderAddress(),
      to: student.email,
      replyTo: getReplyToAddress(),
      subject,
      html: htmlContent,
      text: `Dear ${student.fullName},\n\nYour application could not be approved at this time.\nReason: ${reason}\n\n${libraryName} Team`,
    });

    emailLog.status = 'accepted';
    emailLog.messageId = info.messageId;
    await emailLog.save();
    return { success: true };
  } catch (err) {
    emailLog.status = 'failed';
    emailLog.errorInfo = err.message;
    await emailLog.save();
    return { success: false, error: err.message };
  }
};

/**
 * 5. VERIFY EMAIL CONNECTION
 * Tests SMTP credentials and returns clean status without exposing secrets.
 */
const verifyEmailConnection = async () => {
  if (!isEmailConfigured()) {
    return {
      configured: false,
      verified: false,
      message: 'SMTP credentials not configured in environment (EMAIL_USER / EMAIL_PASSWORD).',
    };
  }
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return {
      configured: true,
      verified: true,
      message: 'SMTP connection verified successfully with provider.',
    };
  } catch (err) {
    return {
      configured: true,
      verified: false,
      message: `SMTP connection failed: ${err.message}`,
    };
  }
};

/**
 * 6. SEND TEST EMAIL
 * Sends an actual test email to verify end-to-end SMTP dispatch.
 */
const sendTestEmail = async (recipientEmail) => {
  const targetEmail = (recipientEmail || process.env.EMAIL_USER || 'srselfstudyzone@gmail.com').trim();
  const libraryName = process.env.LIBRARY_NAME || 'SR Library';
  const subject = `SMTP Test Email — ${libraryName}`;

  if (!isEmailConfigured()) {
    return {
      success: false,
      notConfigured: true,
      message: 'SMTP credentials not configured in .env (EMAIL_USER / EMAIL_PASSWORD).',
    };
  }

  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: getSenderAddress(),
      to: targetEmail,
      replyTo: getReplyToAddress(),
      subject,
      text: `Hello,\n\nThis is a real test email confirming that SMTP is correctly configured with ${libraryName} using ${process.env.EMAIL_HOST || 'smtp.gmail.com'} on port ${process.env.EMAIL_PORT || 587} with STARTTLS.\n\nTimestamp: ${new Date().toISOString()}\nSender: ${getSenderAddress()}`,
      html: `
        <div style="font-family:sans-serif;max-width:550px;margin:20px auto;border:1px solid #e2e8f0;border-radius:12px;padding:24px;background:#ffffff;">
          <h2 style="color:#1e3a8a;margin-top:0;">SMTP Test Successful</h2>
          <p>This is a real test email confirming that Gmail SMTP is operating properly with <strong>${libraryName}</strong>.</p>
          <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px;margin:16px 0;font-size:14px;color:#1e293b;">
            <strong>Configuration Details:</strong><br/>
            &bull; Host: <code>${process.env.EMAIL_HOST || 'smtp.gmail.com'}</code><br/>
            &bull; Port: <code>${process.env.EMAIL_PORT || '587'} (STARTTLS)</code><br/>
            &bull; From: <code>${getSenderAddress()}</code><br/>
            &bull; Sent to: <code>${targetEmail}</code><br/>
            &bull; Timestamp: <code>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</code>
          </div>
          <p style="color:#64748b;font-size:13px;">Everything is ready for automatic registration and payment confirmation emails.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      recipient: targetEmail,
      message: `Test email successfully accepted by Gmail SMTP for ${targetEmail}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      message: `Failed to send test email: ${err.message}`,
    };
  }
};

module.exports = {
  isEmailConfigured,
  verifyEmailConnection,
  sendWelcomeEmail,
  sendPaymentConfirmationEmail,
  retryEmailLog,
  sendStudentIdEmail,
  sendRejectionEmail,
  sendTestEmail,
  createTransporter,
  getSenderAddress,
};
