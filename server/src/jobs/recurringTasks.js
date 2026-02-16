const cron = require('node-cron');
const Task = require('../models/Task');
const logger = require('../config/logger');

/**
 * Generate the next instance of a recurring task.
 * Only creates a new instance if no pending/in_progress instance exists
 * for the next occurrence date.
 */
async function generateNextInstance(task) {
  const now = new Date();
  const nextDate = calculateNextOccurrence(task);

  if (!nextDate) return null;

  // Check if recurrence has ended
  if (task.recurrence.endDate && nextDate > new Date(task.recurrence.endDate)) {
    return null;
  }

  // Check if an instance already exists for this date
  const startOfDay = new Date(nextDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(nextDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existing = await Task.findOne({
    userId: task.userId,
    parentTaskId: task._id,
    dueDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'in_progress'] },
  });

  if (existing) return null;

  const instance = await Task.create({
    userId: task.userId,
    title: task.title,
    description: task.description,
    type: task.type,
    tags: task.tags,
    priority: task.priority,
    estimatedDuration: task.estimatedDuration,
    dueDate: nextDate,
    parentTaskId: task._id,
    status: 'pending',
  });

  logger.info(`Generated recurring task instance: "${task.title}" for ${nextDate.toISOString()}`);
  return instance;
}

/**
 * Calculate the next occurrence date based on recurrence settings.
 */
function calculateNextOccurrence(task) {
  const now = new Date();
  const { frequency, interval = 1, daysOfWeek } = task.recurrence;

  if (frequency === 'daily') {
    const next = new Date(now);
    next.setDate(next.getDate() + interval);
    next.setHours(9, 0, 0, 0); // Default to 9 AM
    return next;
  }

  if (frequency === 'weekly') {
    if (daysOfWeek && daysOfWeek.length > 0) {
      // Find the next matching day of the week
      for (let i = 1; i <= 7 * interval; i++) {
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + i);
        if (daysOfWeek.includes(candidate.getDay())) {
          candidate.setHours(9, 0, 0, 0);
          return candidate;
        }
      }
    }
    const next = new Date(now);
    next.setDate(next.getDate() + 7 * interval);
    next.setHours(9, 0, 0, 0);
    return next;
  }

  if (frequency === 'monthly') {
    const next = new Date(now);
    next.setMonth(next.getMonth() + interval);
    next.setHours(9, 0, 0, 0);
    return next;
  }

  return null;
}

/**
 * Process all recurring tasks and generate upcoming instances.
 * Runs daily via cron.
 */
async function processRecurringTasks() {
  try {
    const recurringTasks = await Task.find({
      isRecurring: true,
      status: { $ne: 'archived' },
      parentTaskId: null, // Only process template tasks, not instances
    });

    logger.info(`Processing ${recurringTasks.length} recurring tasks`);

    let created = 0;
    for (const task of recurringTasks) {
      const instance = await generateNextInstance(task);
      if (instance) created++;
    }

    logger.info(`Created ${created} recurring task instances`);
  } catch (err) {
    logger.error('Error processing recurring tasks:', err);
  }
}

/**
 * Start the recurring tasks cron job.
 * Runs every day at midnight.
 */
function startRecurringTasksJob() {
  cron.schedule('0 0 * * *', processRecurringTasks);
  logger.info('Recurring tasks cron job scheduled (daily at midnight)');

  // Also run once on startup to catch up
  processRecurringTasks();
}

module.exports = { startRecurringTasksJob, processRecurringTasks, generateNextInstance };
