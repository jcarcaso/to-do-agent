const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const validateEnv = require('./config/validateEnv');
validateEnv();

const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const logger = require('./config/logger');
const app = require('./app');

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Socket.io connection with user tracking for notifications
const { setIo, registerUserSocket, unregisterUserSocket } = require('./jobs/morningCheckIn');
setIo(io);

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('register', (userId) => {
    if (userId) {
      registerUserSocket(userId, socket.id);
      logger.info(`User ${userId} registered on socket ${socket.id}`);
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/todo-agent';

mongoose.connect(MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');

    // Start cron jobs after DB is connected
    const { startRecurringTasksJob } = require('./jobs/recurringTasks');
    startRecurringTasksJob();

    const { startMorningCheckInJob } = require('./jobs/morningCheckIn');
    startMorningCheckInJob();

    const { startPatternLearningJob } = require('./jobs/patternLearning');
    startPatternLearningJob();

    const { startTaskCleanupJob } = require('./jobs/taskCleanup');
    startTaskCleanupJob();
  })
  .catch((err) => logger.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on 0.0.0.0:${PORT}`);
});

module.exports = { app, io };
