const express = require('express');
const User = require('../models/User');

const router = express.Router();

// GET /api/metrics - counts residents by category, excluding Secretary staff accounts
router.get('/', async (req, res) => {
  try {
    const total = await User.countDocuments({ category: { $ne: 'Secretary' } });
    const senior = await User.countDocuments({ category: 'Senior Citizen' });
    const pwd = await User.countDocuments({ category: 'PWD / Solo Parent' });

    res.json({ total, senior, pwd });
  } catch (err) {
    res.status(500).json({ message: 'Failed to calculate metrics.' });
  }
});

module.exports = router;
