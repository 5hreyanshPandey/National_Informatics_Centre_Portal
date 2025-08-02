const mongoose = require('mongoose');
const connectDB = require('../config/db');
require('dotenv').config();

const testConnection = async () => {
  try {
    await connectDB();
    console.log('Connection test successful');
    process.exit(0);
  } catch (err) {
    console.error('Connection test failed:', err.message);
    process.exit(1);
  }
};

testConnection();