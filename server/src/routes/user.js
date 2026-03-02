const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const smsService = require('../services/sms');
const logger = require('../config/logger');

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
    const { morningCheckInTime, timezone, notificationChannels, phoneNumber, theme, archiveAfterDays, purgeAfterDays } = req.body;

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

    if (archiveAfterDays !== undefined) {
      const val = Number(archiveAfterDays);
      if (!Number.isInteger(val) || val < 1 || val > 365) {
        return res.status(400).json({ error: 'archiveAfterDays must be an integer between 1 and 365' });
      }
      updates['preferences.archiveAfterDays'] = val;
    }

    if (purgeAfterDays !== undefined) {
      const val = Number(purgeAfterDays);
      if (!Number.isInteger(val) || val < 7 || val > 365) {
        return res.status(400).json({ error: 'purgeAfterDays must be an integer between 7 and 365' });
      }
      updates['preferences.purgeAfterDays'] = val;
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

// POST /api/user/verify-sms
router.post('/verify-sms', async (req, res) => {
  try {
    const phone = req.user.preferences?.phoneNumber;
    if (!phone) {
      return res.status(400).json({ error: 'No phone number configured' });
    }
    if (!smsService.isConfigured()) {
      return res.status(503).json({ error: 'SMS is not configured on this server' });
    }

    await smsService.sendSms(phone, 'Hello, this is your personal To-Do Agent. Let me know if you need anything!');
    res.json({ success: true });
  } catch (err) {
    logger.error(`Verify SMS failed for ${req.user.name}: ${err.message}`);
    res.status(500).json({ error: 'Failed to send verification SMS' });
  }
});

module.exports = router;
