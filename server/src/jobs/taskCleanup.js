const cron = require('node-cron');
const Task = require('../models/Task');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Archive completed tasks and purge old archived tasks for all users.
 */
async function processTaskCleanup() {
  try {
    const users = await User.find({});
    logger.info(`Running task cleanup for ${users.length} users`);

    let totalArchived = 0;
    let totalPurged = 0;

    for (const user of users) {
      const archiveAfterDays = user.preferences?.archiveAfterDays ?? 2;
      const purgeAfterDays = user.preferences?.purgeAfterDays ?? 90;

      // Archive completed tasks older than archiveAfterDays
      const archiveCutoff = new Date();
      archiveCutoff.setDate(archiveCutoff.getDate() - archiveAfterDays);

      const archiveResult = await Task.updateMany(
        {
          userId: user._id,
          status: 'completed',
          completedAt: { $lte: archiveCutoff },
        },
        { status: 'archived' }
      );
      totalArchived += archiveResult.modifiedCount;

      // Purge archived tasks older than purgeAfterDays
      const purgeCutoff = new Date();
      purgeCutoff.setDate(purgeCutoff.getDate() - purgeAfterDays);

      const purgeResult = await Task.deleteMany({
        userId: user._id,
        status: 'archived',
        updatedAt: { $lte: purgeCutoff },
      });
      totalPurged += purgeResult.deletedCount;
    }

    logger.info(`Task cleanup complete: ${totalArchived} archived, ${totalPurged} purged`);
  } catch (err) {
    logger.error('Error running task cleanup:', err);
  }
}

/**
 * Start the task cleanup cron job.
 * Runs every day at midnight.
 */
function startTaskCleanupJob() {
  cron.schedule('0 0 * * *', processTaskCleanup);
  logger.info('Task cleanup cron job scheduled (daily at midnight)');

  // Also run once on startup to catch up
  processTaskCleanup();
}

module.exports = { startTaskCleanupJob, processTaskCleanup };
