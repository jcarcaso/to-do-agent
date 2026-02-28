const { google } = require('googleapis');
const User = require('../models/User');
const logger = require('../config/logger');

// App identifier used to tag events we create
const APP_TAG = 'todo-agent-managed';

/**
 * Get an authenticated Google Calendar client for a user.
 * Handles token refresh automatically.
 */
async function getCalendarClient(user) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );

  oauth2Client.setCredentials({
    access_token: user.googleCalendarTokens.accessToken,
    refresh_token: user.googleCalendarTokens.refreshToken,
  });

  // Auto-refresh: listen for new tokens and persist them
  oauth2Client.on('tokens', async (tokens) => {
    const update = { 'googleCalendarTokens.accessToken': tokens.access_token };
    if (tokens.refresh_token) {
      update['googleCalendarTokens.refreshToken'] = tokens.refresh_token;
    }
    await User.findByIdAndUpdate(user._id, update);
    logger.info(`Refreshed Google tokens for user ${user._id}`);
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Fetch calendar events for a date range.
 * Read-only — safe to call on any calendar.
 */
async function getEvents(user, timeMin, timeMax) {
  const calendar = await getCalendarClient(user);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return res.data.items || [];
}

/**
 * Interpret a datetime string as being in the given IANA timezone.
 * Naive strings like "2026-02-28T19:00" are otherwise parsed as UTC by
 * `new Date()`, which shifts the event by the UTC offset.
 */
function toISOInTimezone(dateTimeStr, timeZone) {
  const d = new Date(dateTimeStr);
  // If the string already has timezone info (Z, +XX:XX), use it as-is
  if (/[Zz]|[+-]\d{2}:\d{2}$/.test(dateTimeStr)) {
    return d.toISOString();
  }
  // Naive string — interpret as local time in the user's timezone.
  // Get what UTC time corresponds to this wall-clock time in the given tz.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  // Find the offset: format `d` (treated as UTC) in the target tz, then compute the diff
  const utcMs = d.getTime();
  const parts = formatter.formatToParts(new Date(utcMs));
  const get = (type) => parseInt(parts.find(p => p.type === type).value);
  const tzMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const offsetMs = tzMs - utcMs;
  // The real UTC time = naive time (parsed as UTC) minus the offset
  return new Date(utcMs - offsetMs).toISOString();
}

/**
 * Create a calendar event for a task.
 * Tags the event with extendedProperties so we can identify it as ours.
 */
async function createEvent(user, { title, description, startTime, endTime, taskId }) {
  const calendar = await getCalendarClient(user);
  const tz = user.preferences?.timezone || 'America/New_York';

  const event = {
    summary: title,
    description: description || '',
    start: {
      dateTime: toISOInTimezone(startTime, tz),
      timeZone: tz,
    },
    end: {
      dateTime: toISOInTimezone(endTime, tz),
      timeZone: tz,
    },
    // SAFETY: Tag this event as created by our app
    extendedProperties: {
      private: {
        managedBy: APP_TAG,
        taskId: taskId.toString(),
      },
    },
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  logger.info(`Created calendar event ${res.data.id} for task ${taskId}`);
  return res.data;
}

/**
 * Update a calendar event — ONLY if it was created by this app.
 * Verifies ownership via extendedProperties before modifying.
 */
async function updateEvent(user, eventId, updates) {
  const calendar = await getCalendarClient(user);

  // SAFETY: Fetch the event first and verify we own it
  const existing = await calendar.events.get({
    calendarId: 'primary',
    eventId,
  });

  if (!isOurEvent(existing.data)) {
    throw new Error('Cannot modify event: not created by To-Do Agent');
  }

  const patch = {};
  if (updates.title) patch.summary = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.startTime && updates.endTime) {
    const tz = user.preferences?.timezone || 'America/New_York';
    patch.start = { dateTime: toISOInTimezone(updates.startTime, tz), timeZone: tz };
    patch.end = { dateTime: toISOInTimezone(updates.endTime, tz), timeZone: tz };
  }

  const res = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: patch,
  });

  logger.info(`Updated calendar event ${eventId}`);
  return res.data;
}

/**
 * Delete a calendar event — ONLY if it was created by this app.
 * Verifies ownership via extendedProperties before deleting.
 */
async function deleteEvent(user, eventId) {
  const calendar = await getCalendarClient(user);

  // SAFETY: Fetch the event first and verify we own it
  const existing = await calendar.events.get({
    calendarId: 'primary',
    eventId,
  });

  if (!isOurEvent(existing.data)) {
    throw new Error('Cannot delete event: not created by To-Do Agent');
  }

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });

  logger.info(`Deleted calendar event ${eventId}`);
}

/**
 * SAFETY CHECK: Verify an event was created by this application.
 * Checks extendedProperties.private.managedBy === APP_TAG
 */
function isOurEvent(event) {
  return event?.extendedProperties?.private?.managedBy === APP_TAG;
}

module.exports = {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  isOurEvent,
  APP_TAG,
};
