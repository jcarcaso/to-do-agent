const Task = require('../models/Task');

/**
 * Update parent task status based on subtask states.
 * If all subtasks are completed, parent is completed.
 * If any subtask is in_progress, parent is in_progress.
 */
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

/**
 * Build dependency tree with circular dependency detection.
 * Returns array of dependency nodes or { circular: true } if cycle detected.
 */
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

module.exports = { updateParentStatus, buildDependencyTree };
