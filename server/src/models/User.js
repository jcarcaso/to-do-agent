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
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    archiveAfterDays: { type: Number, default: 2, min: 1, max: 365 },
    purgeAfterDays: { type: Number, default: 90, min: 7, max: 365 },
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
