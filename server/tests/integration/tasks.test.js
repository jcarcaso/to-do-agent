const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB, clearDB, disconnectDB } = require('../setup');
const app = require('../../src/app');
const Task = require('../../src/models/Task');
const { createTestUser, generateToken } = require('../helpers');

beforeAll(connectDB);
afterEach(clearDB);
afterAll(disconnectDB);

let user, token;

beforeEach(async () => {
  user = await createTestUser();
  token = generateToken(user._id);
});

describe('POST /api/tasks', () => {
  it('should create a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New task', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New task');
    expect(res.body.priority).toBe('high');
    expect(res.body.userId.toString()).toBe(user._id.toString());
  });

  it('should reject without title', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ priority: 'high' });

    expect(res.status).toBe(400);
  });

  it('should reject unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Test' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/tasks', () => {
  beforeEach(async () => {
    await Task.create([
      { userId: user._id, title: 'Task 1', status: 'pending' },
      { userId: user._id, title: 'Task 2', status: 'completed' },
      { userId: user._id, title: 'Task 3', status: 'pending' },
    ]);
  });

  it('should return only the authenticated user\'s tasks', async () => {
    const otherUser = await createTestUser({ email: 'other@example.com', googleId: 'other-id' });
    await Task.create({ userId: otherUser._id, title: 'Other task' });

    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(3);
  });

  it('should filter by status', async () => {
    const res = await request(app)
      .get('/api/tasks?status=pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.tasks.every(t => t.status === 'pending')).toBe(true);
  });

  it('should paginate results', async () => {
    const res = await request(app)
      .get('/api/tasks?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.pages).toBe(2);
  });
});

describe('PUT /api/tasks/:id', () => {
  it('should update a task', async () => {
    const task = await Task.create({ userId: user._id, title: 'Original' });

    const res = await request(app)
      .put(`/api/tasks/${task._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
  });

  it('should return 404 for another user\'s task', async () => {
    const otherUser = await createTestUser({ email: 'other2@example.com', googleId: 'other-id-2' });
    const task = await Task.create({ userId: otherUser._id, title: 'Other' });

    const res = await request(app)
      .put(`/api/tasks/${task._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hacked' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('should archive task and its subtasks', async () => {
    const parent = await Task.create({ userId: user._id, title: 'Parent' });
    const subtask = await Task.create({
      userId: user._id,
      title: 'Subtask',
      parentTaskId: parent._id,
    });
    parent.subtasks = [subtask._id];
    await parent.save();

    const res = await request(app)
      .delete(`/api/tasks/${parent._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const archivedParent = await Task.findById(parent._id);
    const archivedSubtask = await Task.findById(subtask._id);
    expect(archivedParent.status).toBe('archived');
    expect(archivedSubtask.status).toBe('archived');
  });
});

describe('PUT /api/tasks/:id/status', () => {
  it('should block completion when dependencies are incomplete', async () => {
    const dep = await Task.create({ userId: user._id, title: 'Dependency', status: 'pending' });
    const task = await Task.create({
      userId: user._id,
      title: 'Blocked task',
      dependencies: [dep._id],
    });

    const res = await request(app)
      .put(`/api/tasks/${task._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('dependencies');
  });

  it('should allow completion when dependencies are complete', async () => {
    const dep = await Task.create({ userId: user._id, title: 'Dep', status: 'completed' });
    const task = await Task.create({
      userId: user._id,
      title: 'Task',
      dependencies: [dep._id],
    });

    const res = await request(app)
      .put(`/api/tasks/${task._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });
});
