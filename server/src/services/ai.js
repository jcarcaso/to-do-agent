const Anthropic = require('@anthropic-ai/sdk');
const Task = require('../models/Task');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const UserPattern = require('../models/UserPattern');
const calendarService = require('./calendar');
const { updateParentStatus } = require('./taskHelpers');
const logger = require('../config/logger');

function getAnthropicClient() {
  const token = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!token) throw new Error('CLAUDE_CODE_OAUTH_TOKEN is not set');
  logger.info(`Anthropic SDK call - token set: true, token length: ${token.length}`);
  return new Anthropic({ apiKey: token });
}

/**
 * Call Claude via the Anthropic SDK.
 */
async function callClaude(systemPrompt, messages) {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });
  return response.content[0].text;
}

// --- Context builders ---

async function buildUserContext(user) {
  const timeZone = user.preferences?.timezone || 'America/New_York';

  // Calculate start-of-day in the user's timezone, not server UTC.
  const now = new Date();
  const intlOpts = {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  };
  const tzParts = new Intl.DateTimeFormat('en-US', { ...intlOpts, timeZone }).formatToParts(now);
  const utcParts = new Intl.DateTimeFormat('en-US', { ...intlOpts, timeZone: 'UTC' }).formatToParts(now);
  const get = (parts, type) => parseInt(parts.find(p => p.type === type).value);

  // Offset = user's local time - UTC (e.g. -5 hours for EST)
  const utcMs = Date.UTC(get(utcParts,'year'), get(utcParts,'month')-1, get(utcParts,'day'), get(utcParts,'hour'), get(utcParts,'minute'));
  const tzMs = Date.UTC(get(tzParts,'year'), get(tzParts,'month')-1, get(tzParts,'day'), get(tzParts,'hour'), get(tzParts,'minute'));
  const offsetMs = tzMs - utcMs;

  // Midnight of user's today in UTC
  const userTodayMidnightUTC = Date.UTC(get(tzParts,'year'), get(tzParts,'month')-1, get(tzParts,'day'));
  const startOfDay = new Date(userTodayMidnightUTC - offsetMs);
  const endOfRange = new Date(startOfDay.getTime() + 3 * 24 * 60 * 60 * 1000 - 1);

  const tasks = await Task.find({
    userId: user._id,
    status: { $in: ['pending', 'in_progress'] },
    parentTaskId: null,
  })
    .sort({ priority: -1, dueDate: 1 })
    .limit(20)
    .lean();

  let calendarEvents = [];
  if (user.googleCalendarTokens?.accessToken) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        calendarEvents = await calendarService.getEvents(user, startOfDay, endOfRange);
        break;
      } catch (err) {
        logger.warn(`Could not fetch calendar events: ${err.message || JSON.stringify(err)}`);
        if (attempt === 0) {
          const freshUser = await User.findById(user._id);
          if (freshUser?.googleCalendarTokens?.accessToken) {
            user.googleCalendarTokens = freshUser.googleCalendarTokens;
          }
        }
      }
    }
  }

  const patterns = await UserPattern.findOne({ userId: user._id }).lean();

  const recentConversations = await Conversation.find({
    userId: user._id,
    status: 'completed',
  })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  const recentSummary = recentConversations.map(c => {
    const lastMsg = c.messages[c.messages.length - 1];
    return `${c.type} (${new Date(c.createdAt).toLocaleDateString('en-US', { timeZone })}): ${lastMsg?.content?.slice(0, 100)}...`;
  }).join('\n');

  return { tasks, calendarEvents, patterns, recentSummary };
}

function formatTasks(tasks, timeZone) {
  if (!tasks.length) return 'No pending tasks.';

  return tasks.map((t, i) => {
    const parts = [`${i + 1}. [ID:${t._id}] "${t.title}" [${t.priority}]`];
    if (t.dueDate) parts.push(`Due: ${new Date(t.dueDate).toLocaleDateString('en-US', { timeZone })}`);
    if (t.estimatedDuration) parts.push(`Est: ${t.estimatedDuration}min`);
    if (t.type !== 'other') parts.push(`Type: ${t.type}`);
    if (t.status === 'in_progress') parts.push('(in progress)');
    return parts.join(' | ');
  }).join('\n');
}

function formatCalendar(events, timeZone) {
  if (!events.length) return 'No calendar events in the next 3 days.';

  return events.map(e => {
    const startDt = e.start?.dateTime ? new Date(e.start.dateTime) : null;
    const endDt = e.end?.dateTime ? new Date(e.end.dateTime) : null;
    const date = startDt
      ? startDt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone })
      : e.start?.date || '';
    const start = startDt
      ? startDt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone })
      : 'All day';
    const end = endDt
      ? endDt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone })
      : '';
    return `- ${date} ${start}${end ? ` - ${end}` : ''}: ${e.summary || '(No title)'}`;
  }).join('\n');
}

function formatPatterns(patterns) {
  if (!patterns) return 'No pattern data yet (new user).';

  const parts = [];
  if (patterns.mostProductiveHours?.length) {
    parts.push(`Most productive hours: ${patterns.mostProductiveHours.map(h => `${h}:00`).join(', ')}`);
  }
  if (patterns.totalTasksCompleted) {
    parts.push(`Total tasks completed: ${patterns.totalTasksCompleted}`);
  }
  if (patterns.completionRateByTaskType?.size > 0) {
    const rates = Object.entries(Object.fromEntries(patterns.completionRateByTaskType))
      .map(([type, rate]) => `${type}: ${Math.round(rate * 100)}%`)
      .join(', ');
    parts.push(`Completion rates by type: ${rates}`);
  }

  return parts.length ? parts.join('\n') : 'Limited pattern data available.';
}

function buildSystemPrompt(type, user, context) {
  const timeZone = user.preferences?.timezone || 'America/New_York';
  const base = `You are an AI productivity assistant for a personal task management app called To-Do Agent. Be conversational, warm, but concise and actionable.

When the user asks to create, update, complete, start, or delete tasks, include the appropriate actions in your response. Use task IDs from the PENDING TASKS list provided below. If ambiguous, ask for clarification instead of guessing.

AVAILABLE ACTIONS:
You can perform task actions by including action blocks in your response. Use this format exactly:
[ACTION: {"type": "create_task", "params": {"title": "...", "priority": "medium", "dueDate": "YYYY-MM-DD", "type": "other"}}]
[ACTION: {"type": "update_task", "params": {"taskId": "...", "fields": {"title": "...", "priority": "...", "dueDate": "..."}}}]
[ACTION: {"type": "complete_task", "params": {"taskId": "..."}}]
[ACTION: {"type": "delete_task", "params": {"taskId": "..."}}]
[ACTION: {"type": "start_task", "params": {"taskId": "..."}}]
[ACTION: {"type": "schedule_task", "params": {"taskId": "...", "startTime": "YYYY-MM-DDTHH:MM", "endTime": "YYYY-MM-DDTHH:MM"}}]
[ACTION: {"type": "unschedule_task", "params": {"taskId": "..."}}]

RULES FOR ACTIONS:
- Only perform actions when the user explicitly asks you to create, update, complete, delete, start, schedule, or unschedule a task.
- Always confirm what you're doing in your text response.
- Use task IDs from the PENDING TASKS list above.
- If the user's request is ambiguous, ask for clarification instead of guessing.
- You may include multiple actions in one response.
- For create_task: "priority" defaults to "medium", "type" defaults to "other". Only "title" is required.
- For update_task: only include fields that should change.
- For schedule_task: blocks time on the user's Google Calendar. If already scheduled, updates the existing event.
- For unschedule_task: removes the task's calendar event.

USER CONTEXT:
- Name: ${user.name}
- Timezone: ${timeZone}
- Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone })}
- Current time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone })}

PENDING TASKS:
${formatTasks(context.tasks, timeZone)}

CALENDAR (next 3 days):
${formatCalendar(context.calendarEvents, timeZone)}

USER PATTERNS:
${formatPatterns(context.patterns)}

${context.recentSummary ? `RECENT CONVERSATION CONTEXT:\n${context.recentSummary}` : ''}`;

  if (type === 'morning_checkin') {
    return `${base}

INSTRUCTIONS:
1. Greet the user warmly and briefly
2. Summarize what's on their plate today (tasks + calendar)
3. Suggest 3-5 tasks to focus on based on due dates, priorities, available time, and their productive hours
4. Propose a realistic plan that fits around their calendar
5. Ask which tasks they'd like to commit to today
6. Offer to block time on their calendar for selected tasks

Be encouraging but realistic. Don't overload their day. If they have limited time, suggest fewer tasks or breaking large tasks into smaller pieces.`;
  }

  if (type === 'task_planning') {
    return `${base}

INSTRUCTIONS:
You're helping the user plan their tasks. You can:
- Suggest how to break down large tasks into subtasks
- Recommend priorities based on due dates and dependencies
- Estimate durations based on similar completed tasks
- Suggest optimal scheduling based on their productive hours
- Help resolve conflicts between tasks

Be practical and specific. Give actionable suggestions.`;
  }

  return `${base}

INSTRUCTIONS:
You're the user's productivity assistant. Help them with whatever they need:
- Answer questions about their tasks and schedule
- Help create, update, or organize tasks
- Provide motivation and accountability
- Suggest productivity strategies
- Help with time management

Keep responses concise. When the user asks you to create or modify tasks, describe what you'd change and confirm before proceeding.`;
}

// --- Action parsing and execution ---

/**
 * Parse [ACTION: {...}] blocks from Claude's response.
 * Returns { cleanMessage, actions }.
 */
function parseActions(responseText) {
  const actionRegex = /\[ACTION:\s*(\{[\s\S]*?\})\s*\]/g;
  const actions = [];
  let match;

  while ((match = actionRegex.exec(responseText)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      actions.push(parsed);
    } catch (err) {
      logger.warn('Failed to parse action block:', match[1], err.message);
    }
  }

  const cleanMessage = responseText.replace(actionRegex, '').replace(/\n{3,}/g, '\n\n').trim();

  return { cleanMessage, actions };
}

async function executeAction(action, user) {
  const { type, params } = action;
  const userId = user._id;

  try {
    switch (type) {
      case 'create_task': {
        const taskData = {
          title: params.title,
          userId,
          priority: params.priority || 'medium',
          type: params.type || 'other',
        };
        if (params.dueDate) taskData.dueDate = new Date(params.dueDate);
        if (params.description) taskData.description = params.description;
        if (params.estimatedDuration) taskData.estimatedDuration = params.estimatedDuration;

        const task = await Task.create(taskData);
        return { success: true, type: 'create_task', task };
      }

      case 'update_task': {
        const fields = { ...params.fields };
        delete fields.userId;
        delete fields._id;
        if (fields.dueDate) fields.dueDate = new Date(fields.dueDate);

        const task = await Task.findOneAndUpdate(
          { _id: params.taskId, userId },
          fields,
          { new: true, runValidators: true }
        );
        if (!task) return { success: false, type: 'update_task', error: 'Task not found' };
        return { success: true, type: 'update_task', task };
      }

      case 'complete_task': {
        const task = await Task.findOne({ _id: params.taskId, userId })
          .populate('dependencies', 'status title');
        if (!task) return { success: false, type: 'complete_task', error: 'Task not found' };

        if (task.dependencies.length > 0) {
          const incomplete = task.dependencies.filter(d => d.status !== 'completed');
          if (incomplete.length > 0) {
            return {
              success: false,
              type: 'complete_task',
              error: `Cannot complete: dependencies not finished (${incomplete.map(d => d.title).join(', ')})`,
            };
          }
        }

        task.status = 'completed';
        task.completedAt = new Date();
        task.completedDuringHour = new Date().getHours();
        await task.save();

        if (task.parentTaskId) {
          await updateParentStatus(task.parentTaskId, userId);
        }

        return { success: true, type: 'complete_task', task };
      }

      case 'delete_task': {
        const task = await Task.findOne({ _id: params.taskId, userId });
        if (!task) return { success: false, type: 'delete_task', error: 'Task not found' };

        await Task.updateMany(
          { _id: { $in: [task._id, ...task.subtasks] }, userId },
          { status: 'archived' }
        );

        if (task.parentTaskId) {
          await Task.findByIdAndUpdate(task.parentTaskId, {
            $pull: { subtasks: task._id },
          });
        }

        return { success: true, type: 'delete_task', task };
      }

      case 'start_task': {
        const task = await Task.findOneAndUpdate(
          { _id: params.taskId, userId },
          { status: 'in_progress' },
          { new: true }
        );
        if (!task) return { success: false, type: 'start_task', error: 'Task not found' };
        return { success: true, type: 'start_task', task };
      }

      case 'schedule_task': {
        if (!user.googleCalendarTokens?.accessToken) {
          return { success: false, type: 'schedule_task', error: 'No Google Calendar connected' };
        }

        const task = await Task.findOne({ _id: params.taskId, userId });
        if (!task) return { success: false, type: 'schedule_task', error: 'Task not found' };

        let event;
        if (task.googleCalendarEventId) {
          event = await calendarService.updateEvent(user, task.googleCalendarEventId, {
            title: task.title,
            description: task.description,
            startTime: params.startTime,
            endTime: params.endTime,
          });
        } else {
          event = await calendarService.createEvent(user, {
            title: task.title,
            description: task.description,
            startTime: params.startTime,
            endTime: params.endTime,
            taskId: task._id,
          });
          task.googleCalendarEventId = event.id;
        }

        task.scheduledStart = new Date(params.startTime);
        task.scheduledEnd = new Date(params.endTime);
        await task.save();

        return { success: true, type: 'schedule_task', task, event };
      }

      case 'unschedule_task': {
        const task = await Task.findOne({ _id: params.taskId, userId });
        if (!task) return { success: false, type: 'unschedule_task', error: 'Task not found' };

        if (!task.googleCalendarEventId) {
          return { success: false, type: 'unschedule_task', error: 'Task is not scheduled on calendar' };
        }

        await calendarService.deleteEvent(user, task.googleCalendarEventId);

        task.googleCalendarEventId = undefined;
        task.scheduledStart = undefined;
        task.scheduledEnd = undefined;
        await task.save();

        return { success: true, type: 'unschedule_task', task };
      }

      default:
        return { success: false, type, error: `Unknown action type: ${type}` };
    }
  } catch (err) {
    logger.error(`Action execution failed (${type}):`, err.message);
    return { success: false, type, error: err.message };
  }
}

// --- Chat flow ---

async function chat(user, message, conversationId = null, type = 'ad_hoc') {
  let conversation;
  if (conversationId) {
    conversation = await Conversation.findOne({ _id: conversationId, userId: user._id });
    if (!conversation) throw new Error('Conversation not found');
  } else {
    conversation = await Conversation.create({
      userId: user._id,
      type,
      channel: 'in_app',
      context: { date: new Date() },
      messages: [],
    });
  }

  const isNewConversation = !conversationId;

  conversation.messages.push({ role: 'user', content: message });

  // Auto-generate title for new conversations (fire-and-forget)
  if (isNewConversation) {
    const convoId = conversation._id;
    callClaude(
      'Generate a 2-4 word title. Return only the title, no quotes or punctuation.',
      [{ role: 'user', content: message }]
    )
      .then(title => {
        const cleanTitle = title.replace(/^["']|["']$/g, '').trim();
        if (cleanTitle) {
          Conversation.findByIdAndUpdate(convoId, { title: cleanTitle }).catch(err =>
            logger.warn('Failed to save auto-generated title:', err.message)
          );
        }
      })
      .catch(err => logger.warn('Failed to generate conversation title:', err.message));
  }

  const context = await buildUserContext(user);
  const systemPrompt = buildSystemPrompt(conversation.type, user, context);

  const messages = conversation.messages.slice(-20).map(m => ({
    role: m.role,
    content: m.content,
  }));
  const rawResponse = await callClaude(systemPrompt, messages);

  const { cleanMessage, actions } = parseActions(rawResponse);

  // Execute any actions Claude included
  const actionResults = [];
  for (const action of actions) {
    const result = await executeAction(action, user);
    actionResults.push(result);
  }

  conversation.messages.push({ role: 'assistant', content: cleanMessage });
  await conversation.save();

  return {
    conversationId: conversation._id,
    message: cleanMessage,
    type: conversation.type,
    actions: actionResults.length > 0 ? actionResults : undefined,
  };
}

async function generateMorningCheckIn(user) {
  const context = await buildUserContext(user);

  if (context.tasks.length === 0 && context.calendarEvents.length === 0) {
    return null;
  }

  return await chat(user, 'Good morning! What does my day look like?', null, 'morning_checkin');
}

async function estimateDuration(user, taskId) {
  const task = await Task.findOne({ _id: taskId, userId: user._id });
  if (!task) throw new Error('Task not found');

  const similarTasks = await Task.find({
    userId: user._id,
    status: 'completed',
    actualDuration: { $exists: true, $gt: 0 },
    $or: [
      { type: task.type },
      { tags: { $in: task.tags || [] } },
    ],
  })
    .sort({ completedAt: -1 })
    .limit(10)
    .lean();

  const context = await buildUserContext(user);
  const systemPrompt = buildSystemPrompt('task_planning', user, context);

  const similarInfo = similarTasks.length
    ? similarTasks.map(t =>
        `"${t.title}" (${t.type}) - estimated: ${t.estimatedDuration || '?'}min, actual: ${t.actualDuration}min`
      ).join('\n')
    : 'No similar completed tasks found.';

  const userMessage = `Estimate how long this task will take:
Task: "${task.title}"
Description: ${task.description || 'None'}
Type: ${task.type}
Tags: ${task.tags?.join(', ') || 'None'}

Similar completed tasks:
${similarInfo}

Respond with ONLY a JSON object: {"estimate": <minutes>, "reasoning": "<brief explanation>"}`;

  const response = await callClaude(systemPrompt, [{ role: 'user', content: userMessage }]);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      task.aiEstimatedDuration = result.estimate;
      await task.save();
      return result;
    }
  } catch (err) {
    logger.warn('Failed to parse duration estimate:', err.message);
  }

  return { estimate: null, reasoning: 'Could not generate estimate' };
}

async function planDay(user) {
  return await chat(
    user,
    'Please help me plan my day. Look at my tasks and calendar and suggest an optimal schedule.',
    null,
    'task_planning'
  );
}

module.exports = {
  chat,
  generateMorningCheckIn,
  estimateDuration,
  planDay,
  buildUserContext,
  parseActions,
  executeAction,
};
