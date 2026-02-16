const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  picture: String,
  preferences: {
    morningCheckInTime: { type: String, default: '08:00' },
    timezone: { type: String, default: 'America/New_York' },
    notificationChannels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    phoneNumber: String,
  },
  googleCalendarTokens: {
    accessToken: String,
    refreshToken: String,
    expiryDate: Number,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
