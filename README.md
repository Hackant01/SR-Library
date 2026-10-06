# 📚 SR Library - Library Management System

A full-stack, production-ready **Library Management System** built with **Node.js**, **Express.js**, **MongoDB**, **Mongoose**, **EJS**, **JWT**, **Razorpay**, and **Nodemailer**.

---

## 🌟 Key Features

### 👤 Student Features
- **Public Landing Page**: Features overview, process guide, pricing table, and contact info.
- **Student Registration**: 3-step registration form with client-side & server-side validation.
- **Razorpay Online Payment**: Integrated ₹150 one-time registration fee payment with server-side HMAC signature verification.
- **Student Login & Dashboard**: Session-based login with profile management, Student ID status, and payment receipt.
- **Email Notifications**: Instant payment receipt email & Student ID assignment notification.

### 🛡️ Admin Features
- **JWT Admin Authentication**: Protected login cookie with password hashing (`bcryptjs`).
- **Dashboard Overview**: Metrics overview (Total Students, Pending Approvals, Active Accounts, Total Revenue).
- **Student Management**: Table view with search, filter (Status, Payment), sorting, and pagination.
- **Assign Student ID**: Automatically generates unique Student ID (e.g. `LIB20260001`) and emails student.
- **Student Actions**: Approve, Deactivate, Resend Email, and Delete student records.

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js, RESTful API architecture
- **Database**: MongoDB & Mongoose ODM
- **Frontend**: EJS Templating Engine, Vanilla CSS3, JavaScript ES6+
- **Authentication**: JWT (Admin) & Express Session (Student)
- **Payment Gateway**: Razorpay Node SDK
- **Email Service**: Nodemailer (SMTP / Gmail)
- **Security**: Helmet, express-rate-limit, cookie-parser, bcryptjs

---

## 📁 Directory Structure

```text
library-management-system/
│
├── app.js                    # Express application entry point
├── package.json              # Project dependencies and scripts
├── .env                      # Environment variables
├── .env.example              # Environment variables template
├── README.md                 # Project documentation
│
├── config/
│   └── db.js                 # MongoDB connection using Mongoose
│
├── models/
│   ├── Admin.js              # Admin schema & password hashing
│   ├── Student.js            # Student schema & validation
│   └── Payment.js            # Razorpay payment records schema
│
├── controllers/
│   ├── adminController.js    # Admin authentication & dashboard logic
│   └── studentController.js  # Student registration, payment & dashboard logic
│
├── routes/
│   ├── adminRoutes.js        # Admin endpoints
│   └── studentRoutes.js      # Student endpoints
│
├── middleware/
│   ├── adminAuth.js          # JWT & Session authentication guards
│   └── validation.js         # Backend registration form validation
│
├── services/
│   └── emailService.js       # Nodemailer email templates & sending logic
│
├── utils/
│   ├── generateStudentId.js  # Unique ID generator (LIB20260001)
│   └── validators.js         # Input validation helpers
│
├── scripts/
│   └── createAdmin.js        # Seed initial admin script
│
├── views/
│   ├── home.ejs              # Public landing page
│   ├── error.ejs             # 404 & 500 error pages
│   ├── admin/
│   │   ├── login.ejs         # Admin login
│   │   ├── dashboard.ejs     # Admin dashboard with statistics
│   │   ├── students.ejs      # Students table & management
│   │   ├── student-details.ejs # Student details view
│   │   ├── profile.ejs       # Admin profile
│   │   └── partials/
│   │       └── sidebar.ejs   # Reusable admin navigation sidebar
│   └── student/
│       ├── register.ejs      # Student registration form
│       ├── payment.ejs       # Razorpay payment screen
│       ├── registration-success.ejs # Success landing page
│       ├── login.ejs         # Student login
│       ├── dashboard.ejs     # Student dashboard
│       └── profile.ejs       # Student profile page
│
└── public/
    ├── css/
    │   ├── style.css         # Main design system tokens & base CSS
    │   ├── admin.css         # Admin dashboard specific layout & dark mode styles
    │   └── responsive.css    # Comprehensive responsive breakpoints
    └── js/
        ├── main.js           # Navigation, scroll & interactive scripts
        ├── registration.js   # Form validation & password strength checker
        └── admin.js          # Admin sidebar & toast notification utilities
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MongoDB running locally (`mongodb://localhost:27017/library_management`) or MongoDB Atlas URI

### Installation

1. **Clone or navigate to project directory**:
   ```bash
   cd project
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in your values:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/library_management
   JWT_SECRET=your_jwt_secret_key
   SESSION_SECRET=your_session_secret
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_gmail_app_password
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   BASE_URL=http://localhost:5000
   LIBRARY_NAME=SR Library
   ```

4. **Seed Super Admin Account**:
   ```bash
   npm run create-admin
   ```
   *Default Admin Credentials:*
   - Email: `admin@srlibrary.com`
   - Password: `Admin@123456`

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Or for production mode:
   ```bash
   npm start
   ```

6. **Access Application**:
   - Landing Page: `http://localhost:5000`
   - Student Registration: `http://localhost:5000/student/register`
   - Student Login: `http://localhost:5000/student/login`
   - Admin Login: `http://localhost:5000/admin/login`

---

## 📜 License
This project is licensed under the MIT License.