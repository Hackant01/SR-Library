const Student = require('../models/Student');

/**
 * Generates a unique Student ID in the format: LIB + YEAR + 4-digit number
 * Example: LIB20260001
 */
const generateStudentId = async () => {
  const year = new Date().getFullYear();
  const prefix = `LIB${year}`;

  // Find all existing student IDs for this year to extract the maximum number
  const students = await Student.find(
    { studentId: { $regex: `^${prefix}\\d+` } },
    { studentId: 1 }
  ).lean();

  let maxNum = 0;
  students.forEach((s) => {
    if (s.studentId) {
      const match = s.studentId.match(/^LIB\d{4}(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  });

  const nextNumber = maxNum + 1;
  const paddedNumber = String(nextNumber).padStart(4, '0');
  const newId = `${prefix}${paddedNumber}`;

  // Ensure uniqueness
  const exists = await Student.findOne({ studentId: newId });
  if (exists) {
    let fallbackNum = nextNumber + 1;
    let fallbackId = `${prefix}${String(fallbackNum).padStart(4, '0')}`;
    while (await Student.findOne({ studentId: fallbackId })) {
      fallbackNum++;
      fallbackId = `${prefix}${String(fallbackNum).padStart(4, '0')}`;
    }
    return fallbackId;
  }

  return newId;
};

module.exports = generateStudentId;
