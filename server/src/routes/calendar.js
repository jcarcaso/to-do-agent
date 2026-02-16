const express = require('express');
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const calendar = require('../services/calendar');

const router = express.Router();

router.use(auth);

// GET /api/calendar/events - Fetch user's calendar events
router.get('/events', async (req, res) => {
  try {
    const { timeMin, timeMax } = req.query;

    if (!timeMin || !timeMax) {
      return res.status(400).json({ error: 'timeMin and timeMax query params required' });
    }

    const events = await calendar.getEvents(req.user, timeMin, timeMax);

    // Mark which events are managed by us
    const enriched = events.map(event => ({
      ...event,
      isManagedByApp: calendar.isOurEvent(event),
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/schedule - Block time on calendar for a task
router.post('/tasks/:id/schedule', async (req, res) => {
  try {
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime required' });
    }

    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // If already scheduled, update instead
    if (task.googleCalendarEventId) {
      const event = await calendar.updateEvent(req.user, task.googleCalendarEventId, {
        title: task.title,
        description: task.description,
        startTime,
        endTime,
      });

      task.scheduledStart = new Date(startTime);
      task.scheduledEnd = new Date(endTime);
      await task.save();

      return res.json({ task, event });
    }

    // Create new calendar event
    const event = await calendar.createEvent(req.user, {
      title: task.title,
      description: task.description,
      startTime,
      endTime,
      taskId: task._id,
    });

    task.googleCalendarEventId = event.id;
    task.scheduledStart = new Date(startTime);
    task.scheduledEnd = new Date(endTime);
    await task.save();

    res.status(201).json({ task, event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id/reschedule - Update scheduled time
router.put('/tasks/:id/reschedule', async (req, res) => {
  try {
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime required' });
    }

    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.googleCalendarEventId) {
      return res.status(400).json({ error: 'Task is not scheduled on calendar' });
    }

    const event = await calendar.updateEvent(req.user, task.googleCalendarEventId, {
      title: task.title,
      description: task.description,
      startTime,
      endTime,
    });

    task.scheduledStart = new Date(startTime);
    task.scheduledEnd = new Date(endTime);
    await task.save();

    res.json({ task, event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id/unschedule - Remove from calendar
router.delete('/tasks/:id/unschedule', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.googleCalendarEventId) {
      return res.status(400).json({ error: 'Task is not scheduled on calendar' });
    }

    await calendar.deleteEvent(req.user, task.googleCalendarEventId);

    task.googleCalendarEventId = undefined;
    task.scheduledStart = undefined;
    task.scheduledEnd = undefined;
    await task.save();

    res.json({ message: 'Task removed from calendar', task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
