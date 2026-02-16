const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const passport = require('./config/passport');
const logger = require('./config/logger');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/user', require('./routes/user'));

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
  })
  .catch((err) => logger.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = { app, io };
