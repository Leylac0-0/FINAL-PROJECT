const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  category: {
    type: String,
    required: true,
    enum: ['General Resident', 'Senior Citizen', 'PWD / Solo Parent', 'Secretary'],
    default: 'General Resident'
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
