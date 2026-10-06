const mongoose = require('mongoose');
const dns = require('dns');

// Fix SRV DNS resolution on Windows / local ISP routers
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if not supported in environment
}

/**
 * Connects to MongoDB using MONGODB_URI from environment variables.
 * Supports both local MongoDB and MongoDB Atlas.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in .env file');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // 10s timeout for Atlas
      socketTimeoutMS: 45000,
    });

    const host = conn.connection.host;
    const dbName = conn.connection.name;

    console.log('==================================================');
    console.log(`✅ MongoDB Connected Successfully`);
    console.log(`   Host    : ${host}`);
    console.log(`   Database: ${dbName}`);
    console.log('==================================================');
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:');
    console.error(`   ${error.message}`);
    console.error('');
    console.error('💡 Please check:');
    console.error('   1. Your MONGODB_URI in .env is correct');
    console.error('   2. Your MongoDB Atlas cluster is running');
    console.error('   3. Your IP is whitelisted in Atlas Network Access');
    console.error('   4. Your Atlas username & password are correct');
    process.exit(1);
  }
};

// Connection event listeners
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB runtime error:', err.message);
});

module.exports = connectDB;
