
const mongoose = require('mongoose');

const ipApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  department: { type: String, required: true },
  contact: { type: String, required: true },
  email: { type: String, required: true },
  location: { type: String, required: true },
  ipForm: { type: String, required: true }, // File path
  macAddress: { type: String },
  antivirus: { type: String, enum: ['Y', 'N'], default: 'N' },
  antivirusName: { type: String },
  operatingSystem: { type: String },
  ipAddress: { type: String },
  status: { type: String, enum: ['pending', 'allocated'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('IPApplication', ipApplicationSchema);