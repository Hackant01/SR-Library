const { isValidEmail, isValidMobile } = require('../utils/validators');

/**
 * Validates student registration form data for the Library Membership Registration Form
 * Returns an array of error messages
 */
const validateStudentRegistration = (data) => {
  const errors = [];

  // Personal Information
  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters');
  }

  if (!data.parentName || data.parentName.trim().length < 2) {
    errors.push("Parent/Guardian name must be at least 2 characters");
  }

  if (!data.dateOfBirth) {
    errors.push('Date of birth is required');
  } else {
    const dob = new Date(data.dateOfBirth);
    const now = new Date();
    const age = (now - dob) / (365.25 * 24 * 60 * 60 * 1000);
    if (isNaN(age) || age < 5 || age > 100) {
      errors.push('Please enter a valid date of birth');
    }
  }

  if (!['male', 'female', 'other'].includes(data.gender)) {
    errors.push('Please select a valid gender');
  }

  if (!data.address || data.address.trim().length < 5) {
    errors.push('Please enter a valid residential address');
  }

  // Contact Details
  if (!data.mobile || !isValidMobile(data.mobile.trim())) {
    errors.push('Please enter a valid 10-digit contact number');
  }

  if (!data.emergencyContact || !isValidMobile(data.emergencyContact.trim())) {
    errors.push('Please enter a valid 10-digit emergency contact number');
  }

  if (!data.email || !isValidEmail(data.email.trim())) {
    errors.push('Please enter a valid email address');
  }

  // Identification
  if (!data.idProofType || data.idProofType.trim().length < 2) {
    errors.push('Please select or specify ID Proof type');
  }

  if (!data.idProofNumber || data.idProofNumber.trim().length < 2) {
    errors.push('Please enter ID Proof number');
  }

  // Education
  if (!data.educationLevel || data.educationLevel.trim().length < 2) {
    errors.push('Please select or enter Education Level');
  }

  if (!data.preparingFor || data.preparingFor.trim().length < 2) {
    errors.push('Please specify what you are preparing for');
  }

  // Membership Details
  if (!data.membershipSlot || data.membershipSlot.trim().length < 2) {
    errors.push('Please select a Membership Slot');
  }

  if (!data.subscriptionPlan || data.subscriptionPlan.trim().length < 2) {
    errors.push('Please select a Subscription Plan');
  }

  if (!data.slotTiming || data.slotTiming.trim().length < 2) {
    errors.push('Please select or specify Slot Timing');
  }

  if (!data.joiningDate) {
    errors.push('Joining date is required');
  }

  // Password & Security
  if (!data.password || data.password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (data.password !== data.confirmPassword) {
    errors.push('Passwords do not match');
  }

  // Declaration
  const declarationAccepted = data.declaration === 'on' || data.declaration === 'true' || data.declaration === true || data.declarationAccepted === true;
  if (!declarationAccepted) {
    errors.push('You must accept the declaration to proceed with registration');
  }

  return errors;
};

module.exports = { validateStudentRegistration };
