const mongoose = require('mongoose');

const ipRangeSchema = new mongoose.Schema({
  range: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Inactive'], required: true },
  allocated: { type: Number, required: true },
  available: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('IPRange', ipRangeSchema);