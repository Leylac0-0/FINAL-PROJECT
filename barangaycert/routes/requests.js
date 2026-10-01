const express = require('express');
const Request = require('../models/Request');
const User = require('../models/User');

const router = express.Router();

// Small helper: blocks the route if nobody is logged in
async function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'You must log in first.' });
  }
  const user = await User.findById(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: 'Session invalid.' });
  }
  req.currentUser = user;
  next();
}

// Generates a simple human-readable tracking code like "BC-482913"
function generateTrackingId() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `BC-${random}`;
}

// POST /api/requests - resident submits a new document request
router.post('/', requireLogin, async (req, res) => {
  try {
    const { documentType, purpose } = req.body;
    if (!documentType || !purpose) {
      return res.status(400).json({ message: 'Document type and purpose are required.' });
    }

    const newRequest = await Request.create({
      trackingId: generateTrackingId(),
      residentUsername: req.currentUser.username,
      residentName: req.currentUser.name,
      category: req.currentUser.category,
      documentType,
      purpose,
      status: 'PENDING'
    });

    res.status(201).json(newRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to submit request.' });
  }
});

// GET /api/requests - full list, newest first (used by the Secretary table)
router.get('/', async (req, res) => {
  try {
    const all = await Request.find().sort({ createdAt: -1 });
    res.json(all);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load requests.' });
  }
});

// GET /api/requests/my-requests - only the logged-in resident's own requests, newest first
router.get('/my-requests', requireLogin, async (req, res) => {
  try {
    const mine = await Request.find({ residentUsername: req.currentUser.username })
      .sort({ createdAt: -1 });
    res.json(mine);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load your requests.' });
  }
});

// GET /api/requests/verify/:trackingId - used by the Secretary's QR scanner
router.get('/verify/:trackingId', async (req, res) => {
  try {
    const found = await Request.findOne({ trackingId: req.params.trackingId });
    if (!found) {
      return res.status(404).json({ message: 'No matching request found.' });
    }
    res.json(found);
  } catch (err) {
    res.status(500).json({ message: 'Verification failed.' });
  }
});

// PATCH /api/requests/:trackingId/status - Secretary approves/rejects/releases a request
router.patch('/:trackingId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['PENDING', 'APPROVED', 'REJECTED', 'RELEASED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const updated = await Request.findOneAndUpdate(
      { trackingId: req.params.trackingId },
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update status.' });
  }
});

module.exports = router;
