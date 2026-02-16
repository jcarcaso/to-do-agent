const cron = require('node-cron');
const Task = require('../models/Task');
const UserPattern = require('../models/UserPattern');
const logger = require('../config/logger');

/**
 * Calculate patterns for a single user based on their completed tasks.
 */
async function calculatePatternsForUser(userId) {
  const completedTasks = await Task.find({
    userId,
    status: 'completed',
    completedAt: { $exists: true },
  }).lean();

  if (completedTasks.length < 3) return null; // Not enough data

  const allTasks = await Task.find({ userId }).lean();

  // Completion rate by hour
  const hourCounts = {};
  const hourTotals = {};
  completedTasks.forEach(t => {
    if (t.completedDuringHour != null) {
      hourCounts[t.completedDuringHour] = (hourCounts[t.completedDuringHour] || 0) + 1;
    }
  });

  // Completion rate by day of week
  const dayCounts = {};
  completedTasks.forEach(t => {
    const day = new Date(t.completedAt).getDay();
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });
  const totalCompleted = completedTasks.length;
  const dayRates = {};
  for (const [day, count] of Object.entries(dayCounts)) {
    dayRates[day] = count / totalCompleted;
  }

  // Completion rate by task type
  const typeCompleted = {};
  const typeTotal = {};
  allTasks.forEach(t => {
    typeTotal[t.type] = (typeTotal[t.type] || 0) + 1;
    if (t.status === 'completed') {
      typeCompleted[t.type] = (typeCompleted[t.type] || 0) + 1;
    }
  });
  const typeRates = {};
  for (const [type, total] of Object.entries(typeTotal)) {
    typeRates[type] = (typeCompleted[type] || 0) / total;
  }

  // Average duration by type
  const durationByType = {};
  const durationCounts = {};
  completedTasks.forEach(t => {
    if (t.actualDuration) {
      durationByType[t.type] = (durationByType[t.type] || 0) + t.actualDuration;
      durationCounts[t.type] = (durationCounts[t.type] || 0) + 1;
    }
  });
  const avgDuration = {};
  for (const [type, total] of Object.entries(durationByType)) {
    avgDuration[type] = Math.round(total / durationCounts[type]);
  }

  // Estimation accuracy by type
  const accuracy = {};
  const accuracyCounts = {};
  completedTasks.forEach(t => {
    if (t.estimatedDuration && t.actualDuration) {
      const ratio = Math.min(t.estimatedDuration, t.actualDuration) /
                    Math.max(t.estimatedDuration, t.actualDuration);
      accuracy[t.type] = (accuracy[t.type] || 0) + ratio;
      accuracyCounts[t.type] = (accuracyCounts[t.type] || 0) + 1;
    }
  });
  const avgAccuracy = {};
  for (const [type, total] of Object.entries(accuracy)) {
    avgAccuracy[type] = Math.round((total / accuracyCounts[type]) * 100) / 100;
  }

  // Most productive hours (top 5 hours by completion count)
  const sortedHours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([h]) => parseInt(h));

  // Preferred task types (sorted by completion count)
  const preferredTypes = Object.entries(typeCompleted)
    .sort(([, a], [, b]) => b - a)
    .map(([type]) => type);

  // Average completion time (days from creation to completion)
  const completionTimes = completedTasks
    .filter(t => t.completedAt && t.createdAt)
    .map(t => (new Date(t.completedAt) - new Date(t.createdAt)) / (1000 * 60 * 60 * 24));
  const avgCompletionTime = completionTimes.length
    ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length * 10) / 10
    : 0;

  // Upsert pattern document
  const pattern = await UserPattern.findOneAndUpdate(
    { userId },
    {
      completionRateByHour: hourCounts,
      completionRateByDayOfWeek: dayRates,
      completionRateByTaskType: typeRates,
      estimationAccuracy: avgAccuracy,
      averageDurationByType: avgDuration,
      preferredTaskTypes: preferredTypes,
      mostProductiveHours: sortedHours,
      totalTasksCompleted: totalCompleted,
      totalTasksCreated: allTasks.length,
      averageCompletionTime: avgCompletionTime,
      lastCalculated: new Date(),
    },
    { upsert: true, new: true }
  );

  logger.info(`Updated patterns for user ${userId}: ${totalCompleted} completed tasks analyzed`);
  return pattern;
}

/**
 * Process pattern learning for all users.
 */
async function processAllPatterns() {
  const Task = require('../models/Task');
  const userIds = await Task.distinct('userId', { status: 'completed' });

  logger.info(`Processing patterns for ${userIds.length} users`);

  for (const userId of userIds) {
    await calculatePatternsForUser(userId);
  }
}

/**
 * Start the pattern learning cron job.
 * Runs every Sunday at 3 AM.
 */
function startPatternLearningJob() {
  cron.schedule('0 3 * * 0', processAllPatterns);
  logger.info('Pattern learning cron job scheduled (weekly, Sunday 3 AM)');
}

module.exports = {
  startPatternLearningJob,
  calculatePatternsForUser,
  processAllPatterns,
};
