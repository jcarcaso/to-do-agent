const logger = require('../config/logger');

let twilioClient = null;

function getClient() {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  twilioClient = require('twilio')(accountSid, authToken);
  return twilioClient;
}

function isConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

async function sendSms(to, body) {
  const client = getClient();
  if (!client) {
    throw new Error('Twilio is not configured');
  }

  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    throw new Error('TWILIO_PHONE_NUMBER is not set');
  }

  const message = await client.messages.create({ to, from, body });
  logger.info(`SMS sent to ${to} (SID: ${message.sid})`);
  return message;
}

function validateRequest(signature, url, params) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  const twilio = require('twilio');
  return twilio.validateRequest(authToken, signature, url, params);
}

module.exports = { sendSms, validateRequest, isConfigured };
