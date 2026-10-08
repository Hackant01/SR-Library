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
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 3000,
    greetingTimeout: 3000,
    socketTimeout: 3000,
  });
};

/**
 * Sends the Student ID assignment email to the student
 */
const sendStudentIdEmail = async (student) => {
  if (!isEmailConfigured()) {
    console.log(`ℹ️ [EmailService] SMTP credentials are placeholder in .env. Skipping real email to ${student.email}. Student ID: ${student.studentId}`);
    return true;
  }

  const transporter = createTransporter();

  const registrationDate = new Date(student.registrationDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const joiningDate = new Date(student.joiningDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Library Registration Successful</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6fb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
    .header { background: linear-gradient(135deg, #1a237e 0%, #283593 100%); padding: 36px 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 26px; letter-spacing: 1px; }
    .header p { color: #c5cae9; margin: 8px 0 0; font-size: 14px; }
    .check-icon { font-size: 48px; margin-bottom: 12px; }
    .body { padding: 36px 32px; }
    .greeting { font-size: 18px; color: #1a237e; font-weight: 600; margin-bottom: 16px; }
    .id-card { background: linear-gradient(135deg, #e8eaf6 0%, #ede7f6 100%); border: 2px solid #3949ab; border-radius: 10px; padding: 20px 24px; margin: 24px 0; text-align: center; }
    .id-label { font-size: 12px; color: #5c6bc0; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
    .id-value { font-size: 32px; font-weight: 700; color: #1a237e; letter-spacing: 3px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .info-table td { padding: 10px 0; border-bottom: 1px solid #e8eaf6; font-size: 15px; }
    .info-table td:first-child { color: #5c6bc0; font-weight: 600; width: 50%; }
    .info-table td:last-child { color: #212121; }
    .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 4px 14px; border-radius: 20px; font-weight: 700; font-size: 13px; }
    .footer { background: #f8f9fa; padding: 24px 32px; text-align: center; border-top: 1px solid #e8eaf6; }
    .footer p { color: #78909c; font-size: 13px; margin: 4px 0; }
    .footer strong { color: #1a237e; }
    .message { color: #424242; font-size: 15px; line-height: 1.7; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="check-icon">✅</div>
      <h1>${process.env.LIBRARY_NAME || 'SR Library'}</h1>
      <p>Library Registration Successful</p>
    </div>
    <div class="body">
      <div class="greeting">Dear ${student.fullName},</div>
      <div class="message">
        Congratulations! Your library registration has been successfully completed and approved by the library administration.
        You can now use your Student ID to access all library services.
      </div>

      <div class="id-card">
        <div class="id-label">Your Student ID</div>
        <div class="id-value">${student.studentId}</div>
      </div>

      <table class="info-table">
        <tr>
          <td>Full Name</td>
          <td>${student.fullName}</td>
        </tr>
        <tr>
          <td>Registered Email</td>
          <td>${student.email}</td>
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
          <td>Registration Fee</td>
          <td>₹${student.registrationFee}</td>
        </tr>
        <tr>
          <td>Payment Method</td>
          <td style="text-transform:uppercase;font-weight:600;">${student.paymentMethod || 'Online'}</td>
        </tr>
        <tr>
          <td>Payment Status</td>
          <td><span class="badge">✓ PAID</span></td>
        </tr>
        <tr>
          <td>Approval Status</td>
          <td><span class="badge" style="background:#e0f2fe;color:#0369a1;">✓ APPROVED</span></td>
        </tr>
        <tr>
          <td>Account Status</td>
          <td><span class="badge">✓ ACTIVE</span></td>
        </tr>
      </table>

      <div class="message">
        Please keep your Student ID safe. You can log in to the student portal using your registered email and password.
      </div>
    </div>
    <div class="footer">
      <p><strong>${process.env.LIBRARY_NAME || 'SR Library'} Administration</strong></p>
      <p>This is an automated email. Please do not reply to this message.</p>
      <p>For support, contact the library office.</p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'SR Library'}" <${process.env.EMAIL_USER}>`,
    to: student.email,
    subject: 'Congratulations! Your Library Registration is Confirmed',
    html: htmlContent,
    text: `
Dear ${student.fullName},

Congratulations!

Your registration with ${process.env.LIBRARY_NAME || 'SR Library'} has been successfully completed.

Student ID:
${student.studentId}

Registration Date:
${registrationDate}

Joining Date:
${joiningDate}

Payment Method:
${student.paymentMethod === 'cash' ? 'Cash' : 'Online'}

Payment Status:
Paid

Account Status:
Active

Please keep your Student ID safe for future library services.

Regards,
${process.env.LIBRARY_NAME || 'SR Library'} Administration
    `,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Sends a payment confirmation email after successful payment
 */
const sendPaymentConfirmationEmail = async (student, payment) => {
  const transporter = createTransporter();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Confirmation</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6fb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
    .header { background: linear-gradient(135deg, #1b5e20 0%, #388e3c 100%); padding: 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; }
    .header p { color: #c8e6c9; margin: 6px 0 0; }
    .body { padding: 30px; }
    .amount { font-size: 42px; font-weight: 700; color: #2e7d32; text-align: center; margin: 20px 0; }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table td { padding: 10px 0; border-bottom: 1px solid #f1f1f1; font-size: 14px; }
    .info-table td:first-child { color: #777; font-weight: 600; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; }
    .footer p { color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 Payment Received</h1>
      <p>${process.env.LIBRARY_NAME || 'SR Library'}</p>
    </div>
    <div class="body">
      <p>Dear <strong>${student.fullName}</strong>,</p>
      <p>Your registration payment has been successfully received.</p>
      <div class="amount">₹${payment.amount}</div>
      <table class="info-table">
        <tr><td>Transaction ID</td><td>${payment.razorpayPaymentId || payment.razorpayOrderId}</td></tr>
        <tr><td>Amount</td><td>₹${payment.amount} INR</td></tr>
        <tr><td>Status</td><td>✅ Success</td></tr>
        <tr><td>Date</td><td>${new Date(payment.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</td></tr>
      </table>
      <p style="margin-top:20px;color:#555;font-size:14px;">
        Your Student ID will be assigned by the library administrator and sent to this email within 24–48 hours. Your account status is currently <strong>Pending</strong>.
      </p>
    </div>
    <div class="footer"><p>This is an automated email. Please do not reply.</p></div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'SR Library'}" <${process.env.EMAIL_USER}>`,
    to: student.email,
    subject: `Payment Successful - ₹${payment.amount} | ${process.env.LIBRARY_NAME || 'SR Library'}`,
    html: htmlContent,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Sends rejection notification email to the student
 */
const sendRejectionEmail = async (student, reason = '') => {
  if (!isEmailConfigured()) {
    console.log(`ℹ️ [EmailService] SMTP credentials are placeholder in .env. Skipping rejection email to ${student.email}.`);
    return true;
  }

  const transporter = createTransporter();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Library Registration Update</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6fb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
    .header { background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%); padding: 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; }
    .header p { color: #ffcdd2; margin: 6px 0 0; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .reason-box { background: #ffebee; border-left: 4px solid #c62828; padding: 14px 18px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee; }
    .footer p { color: #888; font-size: 13px; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${process.env.LIBRARY_NAME || 'SR Library'}</h1>
      <p>Registration Application Status</p>
    </div>
    <div class="body">
      <p>Dear <strong>${student.fullName}</strong>,</p>
      <p>We regret to inform you that your registration application for ${process.env.LIBRARY_NAME || 'SR Library'} could not be approved at this time.</p>
      
      <div class="reason-box">
        <strong>Reason / Remarks:</strong><br/>
        <span>${reason || 'Application details did not meet the verification requirements.'}</span>
      </div>

      <p>If you believe this was an error or would like to submit clarification, please visit the library administration office or contact us.</p>
      <p>Regarding any registration fee paid, please contact the administration desk with your reference details.</p>
    </div>
    <div class="footer">
      <p><strong>${process.env.LIBRARY_NAME || 'SR Library'} Administration</strong></p>
      <p>This is an automated notification.</p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'SR Library'}" <${process.env.EMAIL_USER}>`,
    to: student.email,
    subject: `Registration Application Status - ${process.env.LIBRARY_NAME || 'SR Library'}`,
    html: htmlContent,
    text: `Dear ${student.fullName},\n\nYour library registration was not approved. Reason: ${reason || 'Verification requirements not met.'}\n\nPlease contact the library office for support.\n\nRegards,\n${process.env.LIBRARY_NAME || 'SR Library'} Administration`,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
  sendStudentIdEmail,
  sendPaymentConfirmationEmail,
  sendRejectionEmail,
};
