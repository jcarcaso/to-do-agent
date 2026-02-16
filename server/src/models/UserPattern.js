const mongoose = require('mongoose');

const userPatternSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  completionRateByHour: {
    type: Map,
    of: Number,
    default: {},
  },
  completionRateByDayOfWeek: {
    type: Map,
    of: Number,
    default: {},
  },
  completionRateByTaskType: {
    type: Map,
    of: Number,
    default: {},
  },
  estimationAccuracy: {
    type: Map,
    of: Number,
    default: {},
  },
  averageDurationByType: {
    type: Map,
    of: Number,
    default: {},
  },
  preferredTaskTypes: [String],
  mostProductiveHours: [Number],
  totalTasksCompleted: { type: Number, default: 0 },
  totalTasksCreated: { type: Number, default: 0 },
  averageCompletionTime: { type: Number, default: 0 },
  lastCalculated: Date,
}, {
  timestamps: true,
});

module.exports = mongoose.model('UserPattern', userPatternSchema);
