const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'archived'],
    default: 'pending',
    index: true,
  },

  // Attributes
  tags: [{ type: String, trim: true }],
  type: {
    type: String,
    enum: ['work', 'personal', 'health', 'learning', 'errands', 'other'],
    default: 'other',
  },
  estimatedDuration: Number, // minutes
  actualDuration: Number,    // minutes
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  dueDate: {
    type: Date,
    index: true,
  },

  // Recurring tasks
  isRecurring: { type: Boolean, default: false },
  recurrence: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
    },
    interval: { type: Number, default: 1 },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    endDate: Date,
  },

  // Dependencies
  parentTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null,
  },
  subtasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  }],
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  }],

  // AI Learning Data
  completedAt: Date,
  completedDuringHour: { type: Number, min: 0, max: 23 },
  aiEstimatedDuration: Number,
  similarTaskIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  }],

  // Calendar Integration
  googleCalendarEventId: String,
  scheduledStart: Date,
  scheduledEnd: Date,
}, {
  timestamps: true,
});

// Compound indexes for common queries
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, dueDate: 1 });
taskSchema.index({ userId: 1, priority: 1 });

module.exports = mongoose.model('Task', taskSchema);
