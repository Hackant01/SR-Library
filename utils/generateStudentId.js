const Student = require('../models/Student');

/**
 * Generates a unique Student ID in the format: LIB + YEAR + 4-digit number
 * Example: LIB20260001
 */
const generateStudentId = async () => {
  const year = new Date().getFullYear();
  const prefix = `LIB${year}`;

  // Find the latest student ID with this year prefix
  const lastStudent = await Student.findOne(
    { studentId: { $regex: `^${prefix}` } },
    { studentId: 1 },
    { sort: { studentId: -1 } }
  );

  let nextNumber = 1;
  if (lastStudent && lastStudent.studentId) {
    const lastNumber = parseInt(lastStudent.studentId.replace(prefix, ''), 10);
    nextNumber = lastNumber + 1;
  }

  // Pad to 4 digits (or 5 if > 9999)
  const paddedNumber = String(nextNumber).padStart(4, '0');
  const newId = `${prefix}${paddedNumber}`;

  // Double-check uniqueness
  const exists = await Student.findOne({ studentId: newId });
  if (exists) {
    // Increment further and retry
    return generateStudentId();
  }

  return newId;
};

module.exports = generateStudentId;
