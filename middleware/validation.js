const { isValidEmail, isValidMobile, isValidPassword, isValidPincode } = require('../utils/validators');

/**
 * Validates student registration form data
 * Returns an array of error messages
 */
const validateStudentRegistration = (data) => {
  const errors = [];

  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters');
  }

  if (!data.parentName || data.parentName.trim().length < 2) {
    errors.push("Father's/Mother's name must be at least 2 characters");
  }

  if (!data.dateOfBirth) {
    errors.push('Date of birth is required');
  } else {
    const dob = new Date(data.dateOfBirth);
    const now = new Date();
    const age = (now - dob) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 5 || age > 100) {
      errors.push('Please enter a valid date of birth');
    }
  }

  if (!['male', 'female', 'other'].includes(data.gender)) {
    errors.push('Please select a valid gender');
  }

  if (!data.mobile || !isValidMobile(data.mobile.trim())) {
    errors.push('Please enter a valid 10-digit mobile number');
  }

  if (!data.email || !isValidEmail(data.email.trim())) {
    errors.push('Please enter a valid email address');
  }

  if (!data.password || !isValidPassword(data.password)) {
    errors.push('Password must be at least 8 characters with uppercase, lowercase, and a number');
  }

  if (data.password !== data.confirmPassword) {
    errors.push('Passwords do not match');
  }

  if (!data.address || data.address.trim().length < 5) {
    errors.push('Please enter a valid address');
  }

  if (!data.city || data.city.trim().length < 2) {
    errors.push('City is required');
  }

  if (!data.state || data.state.trim().length < 2) {
    errors.push('State is required');
  }

  if (!data.pincode || !isValidPincode(data.pincode.trim())) {
    errors.push('Please enter a valid 6-digit pincode');
  }

  if (!data.college || data.college.trim().length < 2) {
    errors.push('College/Institution name is required');
  }

  if (!data.course || data.course.trim().length < 2) {
    errors.push('Course is required');
  }

  if (!data.semester || data.semester.trim().length < 1) {
    errors.push('Semester/Year is required');
  }

  if (!data.joiningDate) {
    errors.push('Joining date is required');
  }

  return errors;
};

module.exports = { validateStudentRegistration };
