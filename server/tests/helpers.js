const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../src/models/User');

/**
 * Create a test user in the database and return it.
 */
async function createTestUser(overrides = {}) {
  const defaults = {
    googleId: new mongoose.Types.ObjectId().toString(),
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    picture: 'https://example.com/photo.jpg',
    preferences: {
      morningCheckInTime: '08:00',
      timezone: 'America/New_York',
      notificationChannels: { inApp: true, email: false, sms: false },
      theme: 'system',
    },
  };

  return User.create({ ...defaults, ...overrides });
}

/**
 * Generate a JWT token for a given user ID.
 */
function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { createTestUser, generateToken };
