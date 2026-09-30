const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  trackingId: { type: String, required: true, unique: true },
  residentUsername: { type: String, required: true },
  residentName: { type: String, required: true },
  category: { type: String, required: true },
  documentType: { type: String, required: true },
  purpose: { type: String, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'RELEASED'],
    default: 'PENDING'
  }
}, { timestamps: true });

module.exports = mongoose.model('Request', requestSchema);
