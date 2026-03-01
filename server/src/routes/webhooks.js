const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const aiService = require('../services/ai');
const smsService = require('../services/sms');
const logger = require('../config/logger');

// Twilio sends form-encoded POST bodies
router.use(express.urlencoded({ extended: false }));

/**
 * POST /api/webhooks/twilio
 * Handles inbound SMS from Twilio. No JWT — validated via Twilio signature.
 */
router.post('/twilio', async (req, res) => {
  try {
    // Validate Twilio request signature
    const signature = req.headers['x-twilio-signature'];
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    if (!signature || !smsService.validateRequest(signature, url, req.body)) {
      logger.warn('Invalid Twilio webhook signature');
      return res.status(403).send('<Response><Message>Forbidden</Message></Response>');
    }

    const from = req.body.From;
    const body = (req.body.Body || '').trim();

    if (!from || !body) {
      return res.type('text/xml').send('<Response></Response>');
    }

    // Look up user by phone number
    const user = await User.findOne({ 'preferences.phoneNumber': from });

    if (!user) {
      logger.info(`Inbound SMS from unknown number: ${from}`);
      return res.type('text/xml').send(
        '<Response><Message>Sorry, this number is not linked to a To-Do Agent account. Visit the app to set up SMS.</Message></Response>'
      );
    }

    // Find most recent active SMS conversation, or create new
    const recentConversation = await Conversation.findOne({
      userId: user._id,
      channel: 'sms',
      status: { $ne: 'completed' },
    }).sort({ updatedAt: -1 });

    const conversationId = recentConversation?._id || null;

    const result = await aiService.chat(user, body, conversationId, 'ad_hoc', 'sms');

    // Return TwiML response with AI reply
    const escapedMessage = escapeXml(result.message);
    res.type('text/xml').send(`<Response><Message>${escapedMessage}</Message></Response>`);
  } catch (err) {
    logger.error('Twilio webhook error:', err.message);
    res.type('text/xml').send(
      '<Response><Message>Something went wrong. Please try again later.</Message></Response>'
    );
  }
});

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = router;
