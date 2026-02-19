const express = require('express');
const auth = require('../middleware/auth');
const aiService = require('../services/ai');
const Conversation = require('../models/Conversation');
const { runCheckInForUser } = require('../jobs/morningCheckIn');

const router = express.Router();

router.use(auth);

// POST /api/ai/chat - Send message to AI
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await aiService.chat(req.user, message, conversationId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/morning-checkin - Trigger morning check-in manually
router.post('/morning-checkin', async (req, res) => {
  try {
    const result = await runCheckInForUser(req.user);

    if (!result) {
      return res.json({ message: 'No tasks or events to check in about.' });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/plan-day - Get AI-suggested daily plan
router.post('/plan-day', async (req, res) => {
  try {
    const result = await aiService.planDay(req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/estimate-duration - Estimate task duration
router.post('/estimate-duration', async (req, res) => {
  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required' });
    }

    const result = await aiService.estimateDuration(req.user, taskId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/conversations - List conversations
router.get('/conversations', async (req, res) => {
  try {
    const { type, status, limit = 20 } = req.query;

    const filter = { userId: req.user._id };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const conversations = await Conversation.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('title type channel status createdAt messages')
      .lean();

    // Include preview (last message) for each
    const previews = conversations.map(c => ({
      _id: c._id,
      title: c.title,
      type: c.type,
      channel: c.channel,
      status: c.status,
      createdAt: c.createdAt,
      messageCount: c.messages.length,
      preview: c.messages[c.messages.length - 1]?.content?.slice(0, 100),
    }));

    res.json(previews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ai/conversations/:id - Update conversation (e.g. rename)
router.patch('/conversations/:id', async (req, res) => {
  try {
    const { title } = req.body;

    if (title === undefined) {
      return res.status(400).json({ error: 'title is required' });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title },
      { new: true, runValidators: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/conversations/:id - Get full conversation history
router.get('/conversations/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
