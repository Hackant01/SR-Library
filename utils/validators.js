/**
 * Validates an email address format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates an Indian mobile number (10 digits, starts with 6-9)
 */
const isValidMobile = (mobile) => {
  const mobileRegex = /^[6-9]\d{9}$/;
  return mobileRegex.test(mobile);
};

/**
 * Validates password strength:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
const isValidPassword = (password) => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Validates an Indian pincode (6 digits)
 */
const isValidPincode = (pincode) => {
  const pincodeRegex = /^\d{6}$/;
  return pincodeRegex.test(pincode);
};

/**
 * Sanitizes a string - trims whitespace
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim();
};

module.exports = {
  isValidEmail,
  isValidMobile,
  isValidPassword,
  isValidPincode,
  sanitizeString,
};
