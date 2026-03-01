const cron = require('node-cron');
const User = require('../models/User');
const aiService = require('../services/ai');
const smsService = require('../services/sms');
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
    const smsEnabled = user.preferences?.notificationChannels?.sms &&
      user.preferences?.phoneNumber &&
      smsService.isConfigured();
    const channel = smsEnabled ? 'sms' : 'in_app';

    const result = await aiService.generateMorningCheckIn(user, channel);
    if (!result) {
      logger.info(`Skipping check-in for ${user.name}: no tasks or events`);
      return null;
    }

    // Send SMS if enabled
    if (smsEnabled) {
      try {
        await smsService.sendSms(user.preferences.phoneNumber, result.message);
      } catch (smsErr) {
        logger.error(`SMS delivery failed for ${user.name}:`, smsErr.message);
      }
    }

    // Notify via Socket.io if user is connected
    const socketId = userSockets.get(user._id.toString());
    if (ioInstance && socketId) {
      ioInstance.to(socketId).emit('morning-checkin', {
        conversationId: result.conversationId,
        message: result.message,
      });
    }

    logger.info(`Morning check-in generated for ${user.name} (channel: ${channel})`);
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
  // Find all users with check-ins enabled (in-app or SMS)
  const users = await User.find({
    'preferences.morningCheckInTime': { $exists: true },
    $or: [
      { 'preferences.notificationChannels.inApp': true },
      { 'preferences.notificationChannels.sms': true },
    ],
  });

  for (const user of users) {
    const timeZone = user.preferences?.timezone || 'America/New_York';
    const currentHourInUserTz = new Date().toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone }).padStart(2, '0');
    const userCheckInTime = `${currentHourInUserTz}:00`;

    if (user.preferences.morningCheckInTime === userCheckInTime) {
      logger.info(`Morning check-in triggered for ${user.name} (${timeZone}, ${userCheckInTime})`);
      await runCheckInForUser(user);
    }
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
