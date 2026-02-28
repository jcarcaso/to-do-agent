const request = require('supertest');
const { connectDB, clearDB, disconnectDB } = require('../setup');
const app = require('../../src/app');
const { createTestUser, generateToken } = require('../helpers');

beforeAll(connectDB);
afterEach(clearDB);
afterAll(disconnectDB);

let user, token;

beforeEach(async () => {
  user = await createTestUser();
  token = generateToken(user._id);
});

describe('GET /api/user/preferences', () => {
  it('should return default preferences', async () => {
    const res = await request(app)
      .get('/api/user/preferences')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.morningCheckInTime).toBe('08:00');
    expect(res.body.timezone).toBe('America/New_York');
    expect(res.body.theme).toBe('system');
  });
});

describe('PUT /api/user/preferences', () => {
  it('should update preference fields', async () => {
    const res = await request(app)
      .put('/api/user/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'dark', timezone: 'America/Chicago' });

    expect(res.status).toBe(200);
    expect(res.body.theme).toBe('dark');
    expect(res.body.timezone).toBe('America/Chicago');
  });

  it('should reject invalid theme value', async () => {
    const res = await request(app)
      .put('/api/user/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'neon' });

    expect(res.status).toBe(400);
  });

  it('should reject invalid morningCheckInTime format', async () => {
    const res = await request(app)
      .put('/api/user/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ morningCheckInTime: 'not-a-time' });

    expect(res.status).toBe(400);
  });
});
