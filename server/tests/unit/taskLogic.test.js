const mongoose = require('mongoose');
const { connectDB, clearDB, disconnectDB } = require('../setup');
const Task = require('../../src/models/Task');
const { updateParentStatus, buildDependencyTree } = require('../../src/services/taskHelpers');

beforeAll(connectDB);
afterEach(clearDB);
afterAll(disconnectDB);

const userId = new mongoose.Types.ObjectId();

describe('Task model validation', () => {
  it('should reject invalid status values', async () => {
    const task = new Task({
      userId,
      title: 'Test task',
      status: 'invalid_status',
    });

    await expect(task.validate()).rejects.toThrow();
  });

  it('should accept valid status values', async () => {
    for (const status of ['pending', 'in_progress', 'completed', 'archived']) {
      const task = new Task({ userId, title: 'Test', status });
      await expect(task.validate()).resolves.toBeUndefined();
    }
  });

  it('should require a title', async () => {
    const task = new Task({ userId });
    await expect(task.validate()).rejects.toThrow();
  });

  it('should default status to pending', () => {
    const task = new Task({ userId, title: 'Test' });
    expect(task.status).toBe('pending');
  });
});

describe('updateParentStatus', () => {
  it('should complete parent when all subtasks are completed', async () => {
    const parent = await Task.create({ userId, title: 'Parent' });
    const sub1 = await Task.create({ userId, title: 'Sub 1', parentTaskId: parent._id, status: 'completed' });
    const sub2 = await Task.create({ userId, title: 'Sub 2', parentTaskId: parent._id, status: 'completed' });

    parent.subtasks = [sub1._id, sub2._id];
    await parent.save();

    await updateParentStatus(parent._id, userId);

    const updated = await Task.findById(parent._id);
    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBeDefined();
  });

  it('should set parent to in_progress when any subtask is in_progress', async () => {
    const parent = await Task.create({ userId, title: 'Parent' });
    const sub1 = await Task.create({ userId, title: 'Sub 1', parentTaskId: parent._id, status: 'in_progress' });
    const sub2 = await Task.create({ userId, title: 'Sub 2', parentTaskId: parent._id, status: 'pending' });

    parent.subtasks = [sub1._id, sub2._id];
    await parent.save();

    await updateParentStatus(parent._id, userId);

    const updated = await Task.findById(parent._id);
    expect(updated.status).toBe('in_progress');
  });

  it('should not change parent with no subtasks', async () => {
    const parent = await Task.create({ userId, title: 'Parent' });
    await updateParentStatus(parent._id, userId);

    const updated = await Task.findById(parent._id);
    expect(updated.status).toBe('pending');
  });
});

describe('buildDependencyTree', () => {
  it('should return empty array for task with no dependencies', async () => {
    const task = await Task.create({ userId, title: 'No deps' });
    const tree = await buildDependencyTree(task._id, userId);
    expect(tree).toEqual([]);
  });

  it('should build a tree of dependencies', async () => {
    const dep = await Task.create({ userId, title: 'Dependency' });
    const task = await Task.create({ userId, title: 'Main', dependencies: [dep._id] });

    const tree = await buildDependencyTree(task._id, userId);
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('Dependency');
  });

  it('should detect circular dependencies', async () => {
    const taskA = await Task.create({ userId, title: 'A' });
    const taskB = await Task.create({ userId, title: 'B', dependencies: [taskA._id] });

    // Create circular: A depends on B, B depends on A
    taskA.dependencies = [taskB._id];
    await taskA.save();

    const tree = await buildDependencyTree(taskA._id, userId);
    // The tree for A includes B, and B's subtree should include A with circular flag
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('B');
    // B depends on A, and A is already visited, so it should be circular
    expect(tree[0].dependencies).toHaveLength(1);
    expect(tree[0].dependencies[0].dependencies).toEqual({ circular: true });
  });
});
