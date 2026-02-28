const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// GET /api/user/preferences
router.get('/preferences', async (req, res) => {
  try {
    res.json(req.user.preferences || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/user/preferences
router.put('/preferences', async (req, res) => {
  try {
    const { morningCheckInTime, timezone, notificationChannels, phoneNumber, theme } = req.body;

    const updates = {};

    if (morningCheckInTime !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(morningCheckInTime)) {
        return res.status(400).json({ error: 'morningCheckInTime must be in HH:MM format' });
      }
      updates['preferences.morningCheckInTime'] = morningCheckInTime;
    }

    if (timezone !== undefined) {
      updates['preferences.timezone'] = timezone;
    }

    if (notificationChannels !== undefined) {
      if (typeof notificationChannels !== 'object') {
        return res.status(400).json({ error: 'notificationChannels must be an object' });
      }
      if (notificationChannels.inApp !== undefined) {
        updates['preferences.notificationChannels.inApp'] = !!notificationChannels.inApp;
      }
      if (notificationChannels.email !== undefined) {
        updates['preferences.notificationChannels.email'] = !!notificationChannels.email;
      }
      if (notificationChannels.sms !== undefined) {
        updates['preferences.notificationChannels.sms'] = !!notificationChannels.sms;
      }
    }

    if (phoneNumber !== undefined) {
      updates['preferences.phoneNumber'] = phoneNumber;
    }

    if (theme !== undefined) {
      if (!['light', 'dark', 'system'].includes(theme)) {
        return res.status(400).json({ error: 'theme must be light, dark, or system' });
      }
      updates['preferences.theme'] = theme;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json(user.preferences);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
