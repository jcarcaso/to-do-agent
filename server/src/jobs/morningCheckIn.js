const cron = require('node-cron');
const User = require('../models/User');
const aiService = require('../services/ai');
const logger = require('../config/logger');

// Store references to notify connected clients
let ioInstance = null;
const userSockets = new Map(); // userId -> socketId

function setIo(io) {
  ioInstance = io;
}

function registerUserSocket(userId, socketId) {
  userSockets.set(userId.toString(), socketId);
}

function unregisterUserSocket(userId) {
  userSockets.delete(userId.toString());
}

/**
 * Run morning check-in for a specific user.
 */
async function runCheckInForUser(user) {
  try {
    const result = await aiService.generateMorningCheckIn(user);
    if (!result) {
      logger.info(`Skipping check-in for ${user.name}: no tasks or events`);
      return null;
    }

    // Notify via Socket.io if user is connected
    const socketId = userSockets.get(user._id.toString());
    if (ioInstance && socketId) {
      ioInstance.to(socketId).emit('morning-checkin', {
        conversationId: result.conversationId,
        message: result.message,
      });
    }

    logger.info(`Morning check-in generated for ${user.name}`);
    return result;
  } catch (err) {
    logger.error(`Morning check-in failed for ${user.name}:`, err.message);
    return null;
  }
}

/**
 * Process morning check-ins for all users based on their preferred time.
 */
async function processCheckIns() {
  const now = new Date();
  const currentHour = now.getHours().toString().padStart(2, '0');
  const currentMinute = '00'; // We run on the hour

  const checkInTime = `${currentHour}:${currentMinute}`;

  // Find users whose check-in time matches the current hour
  const users = await User.find({
    'preferences.morningCheckInTime': checkInTime,
    'preferences.notificationChannels.inApp': true,
  });

  logger.info(`Processing morning check-ins for ${users.length} users at ${checkInTime}`);

  for (const user of users) {
    await runCheckInForUser(user);
  }
}

/**
 * Start the morning check-in cron job.
 * Runs every hour on the hour to check for users with that check-in time.
 */
function startMorningCheckInJob() {
  cron.schedule('0 * * * *', processCheckIns);
  logger.info('Morning check-in cron job scheduled (hourly)');
}

module.exports = {
  startMorningCheckInJob,
  runCheckInForUser,
  setIo,
  registerUserSocket,
  unregisterUserSocket,
};
