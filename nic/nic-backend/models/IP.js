

const mongoose = require('mongoose');

const IPSchema = new mongoose.Schema({
  ipAddress: { type: String, required: true, unique: true },
  macAddress: { type: String }, // Made optional
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  mobile: { type: String, required: true },
  designation: { type: String },
  antivirus: { type: String, default: 'N' },
  antivirusName: { type: String },
  location: { type: String, required: true },
  department: { type: String, required: true },
  operatingSystem: { type: String },
  reportingOfficerName: { type: String },
  reportingOfficerEmail: { type: String },
  remark: { type: String },
  status: { type: String, required: true, enum: ['Available', 'Allocated'], default: 'Allocated' },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('IP', IPSchema);
