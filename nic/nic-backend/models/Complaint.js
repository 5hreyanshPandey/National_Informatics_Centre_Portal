

const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  department: { type: String, required: true },
  status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
  remarks: { type: String, default: '' }, // Added remarks field
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);