const nodemailer = require('nodemailer');

const isEmailConfigured = () => {
  return (
    process.env.EMAIL_USER &&
    process.env.EMAIL_USER !== 'your_email@gmail.com' &&
    process.env.EMAIL_PASSWORD &&
    process.env.EMAIL_PASSWORD !== 'your_gmail_app_password'
  );
};

/**
 * Creates a Nodemailer transporter using environment variables
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });
};

/**
 * Sends the Welcome & Student ID assignment email to the student
 */
const sendStudentIdEmail = async (student) => {
  if (!isEmailConfigured()) {
    console.warn(`⚠️ [EmailService] SMTP credentials not configured in .env. Skipping email to ${student.email} for Student ID: ${student.studentId}`);
    return {
      success: false,
      notConfigured: true,
      message: 'SMTP email service is not configured in .env (EMAIL_USER / EMAIL_PASSWORD). Set up Gmail App Password to enable real email delivery.',
    };
  }

  const transporter = createTransporter();

  const registrationDate = new Date(student.registrationDate || student.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const joiningDate = new Date(student.joiningDate || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const libraryName = process.env.LIBRARY_NAME || 'SR Library';
  const isApproved = student.approvalStatus === 'approved';
  const isPaid = student.paymentStatus === 'paid';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to ${libraryName} — Your Student ID</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f6fb; margin: 0; padding: 0; color: #1e293b; }
    .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0d1b6e 0%, #1a237e 60%, #283593 100%); padding: 36px 30px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
    .header p { color: #ffd600; margin: 8px 0 0; font-size: 14px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
    .body { padding: 36px 30px; }
    .greeting { font-size: 18px; color: #0f172a; font-weight: 700; margin-bottom: 14px; }
    .message { color: #334155; font-size: 15px; line-height: 1.7; margin-bottom: 18px; }
    .id-card { background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%); border: 2px solid #6366f1; border-radius: 12px; padding: 22px; margin: 24px 0; text-align: center; }
    .id-label { font-size: 12px; color: #4f46e5; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
    .id-value { font-size: 32px; font-weight: 800; color: #1e1b4b; letter-spacing: 2px; font-family: monospace; }
    .info-table { width: 100%; border-collapse: collapse; margin: 22px 0; }
    .info-table td { padding: 11px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .info-table td:first-child { color: #64748b; font-weight: 600; width: 45%; }
    .info-table td:last-child { color: #0f172a; font-weight: 600; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 12px; }
    .badge-success { background: #dcfce7; color: #15803d; }
    .badge-warning { background: #fef3c7; color: #b45309; }
    .footer { background: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { color: #64748b; font-size: 13px; margin: 4px 0; }
    .footer strong { color: #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${libraryName}</h1>
      <p>Registration Confirmation</p>
    </div>
    <div class="body">
      <div class="greeting">Hello ${student.fullName},</div>
      
      <p class="message">
        Congratulations! Your registration at <strong>${libraryName}</strong> has been completed successfully.
      </p>

      <p class="message">
        Welcome to ${libraryName}! We are happy to have you as a member of our study community.
      </p>

      <div class="id-card">
        <div class="id-label">Your Official Student ID</div>
        <div class="id-value">${student.studentId}</div>
      </div>

      <p class="message">
        Your student details are:
      </p>

      <table class="info-table">
        <tr>
          <td>Student Name</td>
          <td>${student.fullName}</td>
        </tr>
        <tr>
          <td>Student ID</td>
          <td style="font-family:monospace;color:#1e1b4b;">${student.studentId}</td>
        </tr>
        <tr>
          <td>Registered Email</td>
          <td>${student.email}</td>
        </tr>
        <tr>
          <td>Registered Mobile</td>
          <td>${student.mobile}</td>
        </tr>
        <tr>
          <td>Registration Date</td>
          <td>${registrationDate}</td>
        </tr>
        <tr>
          <td>Joining Date</td>
          <td>${joiningDate}</td>
        </tr>
        <tr>
          <td>Payment Method</td>
          <td style="text-transform:uppercase;">${student.paymentMethod || 'Online'}</td>
        </tr>
        <tr>
          <td>Payment Status</td>
          <td>
            <span class="badge ${isPaid ? 'badge-success' : 'badge-warning'}">
              ${isPaid ? '✓ Paid' : '⏳ Pending Cash Collection'}
            </span>
          </td>
        </tr>
        <tr>
          <td>Account Status</td>
          <td>
            <span class="badge ${isApproved ? 'badge-success' : 'badge-warning'}">
              ${isApproved ? '✓ Active & Approved' : '⏳ Pending Verification'}
            </span>
          </td>
        </tr>
      </table>

      <p class="message">
        Please keep your Student ID safe for future reference.
      </p>

      <p class="message">
        You can use your registered login credentials to access your student dashboard and view your booking details.
      </p>

      <p class="message">
        If you need any assistance, please contact the ${libraryName} team using our configured contact details (+91 8103485288 / srselfstudyzone@gmail.com).
      </p>

      <p class="message" style="margin-top:24px;">
        We wish you a productive and successful study experience.
      </p>

      <p class="message" style="margin-top:20px;font-weight:600;">
        Regards,<br/>
        <strong>${libraryName} Team</strong>
      </p>
    </div>
    <div class="footer">
      <p><strong>${libraryName} Administration Desk</strong></p>
      <p>Shahdol, Madhya Pradesh • Open Daily 6:00 AM – 11:00 PM</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:8px;">This is an automated notification. Please keep this record safe.</p>
    </div>
  </div>
</body>
</html>
  `;

  const plainText = `Hello ${student.fullName},

Congratulations! Your registration at ${libraryName} has been completed successfully.

Welcome to ${libraryName}! We are happy to have you as a member of our study community.

Your student details are:

Student Name: ${student.fullName}
Student ID: ${student.studentId}
Registered Email: ${student.email}
Registered Mobile: ${student.mobile}
Registration Date: ${registrationDate}
Joining Date: ${joiningDate}
Payment Status: ${isPaid ? 'Paid' : 'Pending Verification'}
Account Status: ${isApproved ? 'Active' : 'Pending Approval'}

Please keep your Student ID safe for future reference.

You can use your registered login credentials to access your student dashboard and view your booking details.

If you need any assistance, please contact the ${libraryName} team using our configured contact details (+91 8103485288).

We wish you a productive and successful study experience.

Regards,
${libraryName} Team
`;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || libraryName}" <${process.env.EMAIL_USER}>`,
    to: student.email,
    subject: `Welcome to ${libraryName} — Your Student ID`,
    html: htmlContent,
    text: plainText,
  };

  await transporter.sendMail(mailOptions);
  return { success: true, message: `Welcome email sent successfully to ${student.email}` };
};

/**
 * Sends a payment confirmation email after successful payment
 */
const sendPaymentConfirmationEmail = async (student, payment) => {
  if (!isEmailConfigured()) {
    console.warn(`⚠️ [EmailService] SMTP credentials not configured in .env. Skipping payment email to ${student.email}`);
    return { success: false, notConfigured: true };
  }

  const transporter = createTransporter();
  const libraryName = process.env.LIBRARY_NAME || 'SR Library';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Confirmation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f6fb; margin: 0; padding: 0; color: #1e293b; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
    .header { background: linear-gradient(135deg, #1b5e20 0%, #388e3c 100%); padding: 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; }
    .header p { color: #c8e6c9; margin: 6px 0 0; }
    .body { padding: 30px; }
    .amount { font-size: 40px; font-weight: 800; color: #2e7d32; text-align: center; margin: 20px 0; }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .info-table td:first-child { color: #64748b; font-weight: 600; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Received</h1>
      <p>${libraryName}</p>
    </div>
    <div class="body">
      <p>Dear <strong>${student.fullName}</strong>,</p>
      <p>Your library registration fee has been successfully received.</p>
      <div class="amount">₹${payment.amount}</div>
      <table class="info-table">
        <tr><td>Student ID</td><td><strong>${student.studentId || 'Assigned'}</strong></td></tr>
        <tr><td>Transaction ID</td><td>${payment.razorpayPaymentId || payment.razorpayOrderId || 'Verified'}</td></tr>
        <tr><td>Amount</td><td>₹${payment.amount} INR</td></tr>
        <tr><td>Payment Status</td><td><span style="color:#15803d;font-weight:700;">✓ PAID</span></td></tr>
        <tr><td>Date</td><td>${new Date(payment.paymentDate || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</td></tr>
      </table>
      <p style="margin-top:20px;color:#475569;font-size:14px;line-height:1.6;">
        Your student portal account is active. You can log in anytime to view your seat reservation and library access.
      </p>
    </div>
    <div class="footer"><p>This is an automated receipt from ${libraryName}.</p></div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || libraryName}" <${process.env.EMAIL_USER}>`,
    to: student.email,
    subject: `Payment Successful - ₹${payment.amount} | ${libraryName}`,
    html: htmlContent,
  };

  await transporter.sendMail(mailOptions);
  return { success: true };
};

/**
 * Sends rejection notification email to the student
 */
const sendRejectionEmail = async (student, reason = '') => {
  if (!isEmailConfigured()) {
    console.warn(`⚠️ [EmailService] SMTP credentials not configured in .env. Skipping rejection email to ${student.email}`);
    return { success: false, notConfigured: true };
  }

  const transporter = createTransporter();
  const libraryName = process.env.LIBRARY_NAME || 'SR Library';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Library Registration Update</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f6fb; margin: 0; padding: 0; color: #1e293b; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
    .header { background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%); padding: 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; }
    .header p { color: #ffcdd2; margin: 6px 0 0; }
    .body { padding: 32px; color: #334155; line-height: 1.6; }
    .reason-box { background: #ffebee; border-left: 4px solid #c62828; padding: 14px 18px; margin: 20px 0; border-radius: 6px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #eee; }
    .footer p { color: #888; font-size: 13px; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${libraryName}</h1>
      <p>Registration Application Update</p>
    </div>
    <div class="body">
      <p>Dear <strong>${student.fullName}</strong>,</p>
      <p>We regret to inform you that your registration application for ${libraryName} could not be approved at this time.</p>
      
      <div class="reason-box">
        <strong>Reason / Remarks:</strong><br/>
        <span>${reason || 'Application details did not meet the verification requirements.'}</span>
      </div>

      <p>If you believe this was an error or would like to submit clarification, please visit the library administration desk or contact us.</p>
    </div>
    <div class="footer">
      <p><strong>${libraryName} Administration</strong></p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || libraryName}" <${process.env.EMAIL_USER}>`,
    to: student.email,
    subject: `Registration Application Status - ${libraryName}`,
    html: htmlContent,
  };

  await transporter.sendMail(mailOptions);
  return { success: true };
};

module.exports = {
  isEmailConfigured,
  sendStudentIdEmail,
  sendPaymentConfirmationEmail,
  sendRejectionEmail,
};
