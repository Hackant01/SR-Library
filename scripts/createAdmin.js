require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const createAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable is not defined in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@srlibrary.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

    const existingAdmin = await Admin.findOne({ email: adminEmail.toLowerCase() });
    if (existingAdmin) {
      console.log(`⚠️ Admin user with email "${adminEmail}" already exists.`);
      process.exit(0);
    }

    const admin = new Admin({
      name: 'Super Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'superadmin',
    });

    await admin.save();
    console.log('🎉 Super Admin user created successfully!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

createAdmin();
