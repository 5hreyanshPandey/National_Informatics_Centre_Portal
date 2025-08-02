
const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  department: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);