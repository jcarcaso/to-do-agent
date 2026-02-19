const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  channel: {
    type: String,
    enum: ['in_app', 'email', 'sms'],
    default: 'in_app',
  },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['morning_checkin', 'task_planning', 'ad_hoc'],
    default: 'ad_hoc',
  },
  channel: {
    type: String,
    enum: ['in_app', 'email', 'sms'],
    default: 'in_app',
  },
  messages: [messageSchema],
  context: {
    date: Date,
    tasksDiscussed: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    }],
    suggestedPlan: mongoose.Schema.Types.Mixed,
    calendarAvailability: mongoose.Schema.Types.Mixed,
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active',
  },
}, {
  timestamps: true,
});

conversationSchema.index({ userId: 1, createdAt: -1 });
conversationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Conversation', conversationSchema);
