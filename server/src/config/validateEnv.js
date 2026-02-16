const logger = require('./logger');

function validateEnv() {
  const required = [
    'MONGODB_URI',
    'JWT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL',
    'CLIENT_URL',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Reject placeholder JWT_SECRET
  const placeholders = ['your-secret-here', 'changeme', 'secret', 'jwt-secret'];
  if (placeholders.includes(process.env.JWT_SECRET.toLowerCase())) {
    logger.error('JWT_SECRET is set to a placeholder value. Please use a strong, unique secret.');
    process.exit(1);
  }

  // Warn-only for optional vars
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    logger.warn('CLAUDE_CODE_OAUTH_TOKEN is not set. AI features will not work.');
  }
}

module.exports = validateEnv;
