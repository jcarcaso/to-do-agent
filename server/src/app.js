const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const passport = require('./config/passport');
const mongoSanitize = require('express-mongo-sanitize');
const { globalLimiter, authLimiter, aiLimiter } = require('./middleware/rateLimiter');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(mongoSanitize());
app.use(cookieParser());
app.use(passport.initialize());

// Global rate limiting
app.use(globalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes with specific rate limiters
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/ai', aiLimiter, require('./routes/ai'));
app.use('/api/user', require('./routes/user'));

module.exports = app;
