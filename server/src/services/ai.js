const { spawn } = require('child_process');
const Task = require('../models/Task');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const UserPattern = require('../models/UserPattern');
const calendarService = require('./calendar');
const { updateParentStatus } = require('./taskHelpers');
const logger = require('../config/logger');

const CLAUDE_PATH = process.env.CLAUDE_PATH || 'claude';

/**
 * Call Claude CLI as a subprocess.
 * Pipes the prompt via stdin to avoid command-line argument length limits.
 */
function callClaude(fullPrompt) {
  return new Promise((resolve, reject) => {
    const token = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    logger.info(`Claude CLI call - token set: ${!!token}, token length: ${token?.length || 0}`);

    const proc = spawn(CLAUDE_PATH, ['-p', '--model','haiku'], {
      env: (() => {
        const env = {
          ...process.env,
          HOME: process.env.HOME || '/Users/teletran-1',
          CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
        };
        delete env.CLAUDECODE;
        return env;
      })(),
      timeout: 120000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        logger.error(`Claude CLI exited with code ${code} | stderr: ${stderr} | stdout: ${stdout}`);
        reject(new Error('Failed to get response from Claude'));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.on('error', (err) => {
      logger.error('Claude CLI spawn error:', err.message);
      reject(new Error('Failed to get response from Claude'));
    });

    // Write prompt to stdin and close it
    proc.stdin.write(fullPrompt);
    proc.stdin.end();
  });
}

/**
 * Build context about the user's current state for Claude.
 */
async function buildUserContext(user) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfRange = new Date(now);
  endOfRange.setDate(endOfRange.getDate() + 2);
  endOfRange.setHours(23, 59, 59, 999);

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
          // Reload user to pick up refreshed tokens (auto-refresh saves new tokens async)
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
    return `${c.type} (${new Date(c.createdAt).toLocaleDateString()}): ${lastMsg?.content?.slice(0, 100)}...`;
  }).join('\n');

  return { tasks, calendarEvents, patterns, recentSummary };
}

function formatTasks(tasks) {
  if (!tasks.length) return 'No pending tasks.';

  return tasks.map((t, i) => {
    const parts = [`${i + 1}. [ID:${t._id}] "${t.title}" [${t.priority}]`];
    if (t.dueDate) parts.push(`Due: ${new Date(t.dueDate).toLocaleDateString()}`);
    if (t.estimatedDuration) parts.push(`Est: ${t.estimatedDuration}min`);
    if (t.type !== 'other') parts.push(`Type: ${t.type}`);
    if (t.status === 'in_progress') parts.push('(in progress)');
    return parts.join(' | ');
  }).join('\n');
}

function formatCalendar(events) {
  if (!events.length) return 'No calendar events in the next 3 days.';

  return events.map(e => {
    const startDt = e.start?.dateTime ? new Date(e.start.dateTime) : null;
    const endDt = e.end?.dateTime ? new Date(e.end.dateTime) : null;
    const date = startDt
      ? startDt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : e.start?.date || '';
    const start = startDt
      ? startDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'All day';
    const end = endDt
      ? endDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
  const base = `You are an AI productivity assistant for a personal task management app called To-Do Agent. Be conversational, warm, but concise and actionable.

USER CONTEXT:
- Name: ${user.name}
- Timezone: ${user.preferences?.timezone || 'America/New_York'}
- Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

PENDING TASKS:
${formatTasks(context.tasks)}

CALENDAR (next 3 days):
${formatCalendar(context.calendarEvents)}

USER PATTERNS:
${formatPatterns(context.patterns)}

${context.recentSummary ? `RECENT CONVERSATION CONTEXT:\n${context.recentSummary}` : ''}

AVAILABLE ACTIONS:
You can perform task actions by including action blocks in your response. Use this format exactly:
[ACTION: {"type": "create_task", "params": {"title": "...", "priority": "medium", "dueDate": "YYYY-MM-DD", "type": "other"}}]
[ACTION: {"type": "update_task", "params": {"taskId": "...", "fields": {"title": "...", "priority": "...", "dueDate": "..."}}}]
[ACTION: {"type": "complete_task", "params": {"taskId": "..."}}]
[ACTION: {"type": "delete_task", "params": {"taskId": "..."}}]
[ACTION: {"type": "start_task", "params": {"taskId": "..."}}]

RULES FOR ACTIONS:
- Only perform actions when the user explicitly asks you to create, update, complete, delete, or start a task.
- Always confirm what you're doing in your text response.
- Use task IDs from the PENDING TASKS list above.
- If the user's request is ambiguous, ask for clarification instead of guessing.
- You may include multiple actions in one response.
- For create_task: "priority" defaults to "medium", "type" defaults to "other". Only "title" is required.
- For update_task: only include fields that should change.`;

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

function buildFullPrompt(systemPrompt, messageHistory) {
  let prompt = `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\n---\n\nCONVERSATION:\n`;

  for (const msg of messageHistory) {
    const label = msg.role === 'user' ? 'User' : 'Assistant';
    prompt += `${label}: ${msg.content}\n\n`;
  }

  prompt += 'Assistant:';
  return prompt;
}

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

/**
 * Execute a single action on behalf of a user.
 * Returns { success, type, task?, error? }.
 */
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

      default:
        return { success: false, type, error: `Unknown action type: ${type}` };
    }
  } catch (err) {
    logger.error(`Action execution failed (${type}):`, err.message);
    return { success: false, type, error: err.message };
  }
}

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

  conversation.messages.push({ role: 'user', content: message });

  const context = await buildUserContext(user);
  const systemPrompt = buildSystemPrompt(conversation.type, user, context);

  const messageHistory = conversation.messages.slice(-20).map(m => ({
    role: m.role,
    content: m.content,
  }));

  const fullPrompt = buildFullPrompt(systemPrompt, messageHistory);
  const rawResponse = await callClaude(fullPrompt);

  const { cleanMessage, actions } = parseActions(rawResponse);

  // Execute any actions Claude included
  const actionResults = [];
  for (const action of actions) {
    const result = await executeAction(action, user);
    actionResults.push(result);
  }

  // Save the clean message (without action blocks) to conversation
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

  const fullPrompt = `${systemPrompt}

Estimate how long this task will take:
Task: "${task.title}"
Description: ${task.description || 'None'}
Type: ${task.type}
Tags: ${task.tags?.join(', ') || 'None'}

Similar completed tasks:
${similarInfo}

Respond with ONLY a JSON object: {"estimate": <minutes>, "reasoning": "<brief explanation>"}`;

  const response = await callClaude(fullPrompt);

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
