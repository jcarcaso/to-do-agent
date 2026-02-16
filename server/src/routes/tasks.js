const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const auth = require('../middleware/auth');

const router = express.Router();

// All task routes require authentication
router.use(auth);

// POST /api/tasks - Create task
router.post('/', async (req, res) => {
  try {
    const task = await Task.create({
      ...req.body,
      userId: req.user._id,
    });

    // If this is a subtask, add it to parent's subtasks array
    if (task.parentTaskId) {
      await Task.findByIdAndUpdate(task.parentTaskId, {
        $addToSet: { subtasks: task._id },
      });
    }

    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/tasks - List tasks with filtering, sorting, pagination
router.get('/', async (req, res) => {
  try {
    const {
      status,
      type,
      priority,
      search,
      dueBefore,
      dueAfter,
      sort = '-createdAt',
      page = 1,
      limit = 50,
      parentOnly,
    } = req.query;

    const filter = { userId: req.user._id };

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (dueBefore || dueAfter) {
      filter.dueDate = {};
      if (dueBefore) filter.dueDate.$lte = new Date(dueBefore);
      if (dueAfter) filter.dueDate.$gte = new Date(dueAfter);
    }
    if (parentOnly === 'true') {
      filter.parentTaskId = null;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('subtasks', 'title status priority')
        .lean(),
      Task.countDocuments(filter),
    ]);

    res.json({
      tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id - Get single task with subtasks
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })
      .populate('subtasks')
      .populate('dependencies', 'title status')
      .populate('parentTaskId', 'title status');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', async (req, res) => {
  try {
    // Prevent changing userId
    delete req.body.userId;

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id - Soft delete (archive) task and its subtasks
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Archive this task and all subtasks
    await Task.updateMany(
      { _id: { $in: [task._id, ...task.subtasks] }, userId: req.user._id },
      { status: 'archived' }
    );

    // Remove from parent's subtasks array if it has a parent
    if (task.parentTaskId) {
      await Task.findByIdAndUpdate(task.parentTaskId, {
        $pull: { subtasks: task._id },
      });
    }

    res.json({ message: 'Task archived' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/subtasks - Add subtask
router.post('/:id/subtasks', async (req, res) => {
  try {
    const parentTask = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!parentTask) {
      return res.status(404).json({ error: 'Parent task not found' });
    }

    const subtask = await Task.create({
      ...req.body,
      userId: req.user._id,
      parentTaskId: parentTask._id,
    });

    parentTask.subtasks.push(subtask._id);
    await parentTask.save();

    res.status(201).json(subtask);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/tasks/:id/status - Update status with validation
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'in_progress', 'completed', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).populate('dependencies', 'status');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Block completion if dependencies are incomplete
    if (status === 'completed' && task.dependencies.length > 0) {
      const incomplete = task.dependencies.filter(d => d.status !== 'completed');
      if (incomplete.length > 0) {
        return res.status(400).json({
          error: 'Cannot complete task: dependencies not finished',
          incompleteDependencies: incomplete.map(d => ({ id: d._id, title: d.title })),
        });
      }
    }

    task.status = status;

    if (status === 'completed') {
      task.completedAt = new Date();
      task.completedDuringHour = new Date().getHours();
      if (req.body.actualDuration) {
        task.actualDuration = req.body.actualDuration;
      }
    }

    await task.save();

    // Auto-update parent task status based on subtasks
    if (task.parentTaskId) {
      await updateParentStatus(task.parentTaskId, req.user._id);
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/complete - Shorthand to mark complete
router.post('/:id/complete', async (req, res) => {
  req.body.status = 'completed';
  req.params = req.params;
  // Delegate to status update handler
  const task = await Task.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).populate('dependencies', 'status');

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const incomplete = task.dependencies.filter(d => d.status !== 'completed');
  if (incomplete.length > 0) {
    return res.status(400).json({
      error: 'Cannot complete task: dependencies not finished',
      incompleteDependencies: incomplete.map(d => ({ id: d._id, title: d.title })),
    });
  }

  task.status = 'completed';
  task.completedAt = new Date();
  task.completedDuringHour = new Date().getHours();
  if (req.body.actualDuration) {
    task.actualDuration = req.body.actualDuration;
  }

  await task.save();

  if (task.parentTaskId) {
    await updateParentStatus(task.parentTaskId, req.user._id);
  }

  res.json(task);
});

// GET /api/tasks/:id/dependencies - Check dependency chain
router.get('/:id/dependencies', async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).populate('dependencies', 'title status priority dueDate');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Build full dependency tree
    const tree = await buildDependencyTree(task._id, req.user._id);

    res.json({
      task: { id: task._id, title: task.title },
      dependencies: task.dependencies,
      dependencyTree: tree,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: update parent task status based on subtask states
async function updateParentStatus(parentId, userId) {
  const parent = await Task.findOne({ _id: parentId, userId });
  if (!parent || parent.subtasks.length === 0) return;

  const subtasks = await Task.find({ _id: { $in: parent.subtasks } });
  const allCompleted = subtasks.every(s => s.status === 'completed');
  const anyInProgress = subtasks.some(s => s.status === 'in_progress');

  if (allCompleted) {
    parent.status = 'completed';
    parent.completedAt = new Date();
    parent.completedDuringHour = new Date().getHours();
  } else if (anyInProgress) {
    parent.status = 'in_progress';
  }

  await parent.save();
}

// Helper: build dependency tree (with circular detection)
async function buildDependencyTree(taskId, userId, visited = new Set()) {
  if (visited.has(taskId.toString())) {
    return { circular: true };
  }
  visited.add(taskId.toString());

  const task = await Task.findOne({ _id: taskId, userId })
    .populate('dependencies', 'title status');

  if (!task || task.dependencies.length === 0) return [];

  const tree = [];
  for (const dep of task.dependencies) {
    const children = await buildDependencyTree(dep._id, userId, new Set(visited));
    tree.push({
      id: dep._id,
      title: dep.title,
      status: dep.status,
      dependencies: children,
    });
  }

  return tree;
}

module.exports = router;
