const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

/**
 * Middleware to protect admin routes using JWT stored in cookie
 */
const adminAuth = async (req, res, next) => {
  const isApiRequest = req.xhr || 
    req.path.endsWith('/approve') || 
    req.path.endsWith('/reject') || 
    req.path.endsWith('/delete') || 
    req.path.endsWith('/deactivate') || 
    req.path.endsWith('/assign-id') || 
    req.path.endsWith('/resend-email') ||
    Boolean(req.headers.accept && req.headers.accept.includes('application/json')) ||
    Boolean(req.headers['content-type'] && req.headers['content-type'].includes('application/json'));

  try {
    const token = req.cookies?.adminToken;

    if (!token) {
      if (isApiRequest) {
        return res.status(401).json({ success: false, message: 'Admin session expired. Please log in again.' });
      }
      return res.redirect('/admin/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select('-password');

    if (!admin) {
      res.clearCookie('adminToken');
      if (isApiRequest) {
        return res.status(401).json({ success: false, message: 'Admin not found. Please log in again.' });
      }
      return res.redirect('/admin/login');
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.clearCookie('adminToken');
    if (isApiRequest) {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.redirect('/admin/login');
  }
};

/**
 * Middleware to protect student routes using session
 */
const studentAuth = (req, res, next) => {
  if (!req.session?.studentId) {
    return res.redirect('/student/login');
  }
  next();
};

module.exports = { adminAuth, studentAuth };
