
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  designation: { type: String, required: true },
  location: { type: String, required: true },
  department: { type: String, required: true },
  registrationNumber: { type: Number, unique: true, required: true },
  role: { type: String, enum: ['employee', 'admin'], default: 'employee' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);