const request = require('supertest');
const { connectDB, clearDB, disconnectDB } = require('../setup');
const app = require('../../src/app');
const { createTestUser, generateToken } = require('../helpers');

beforeAll(connectDB);
afterEach(clearDB);
afterAll(disconnectDB);

describe('GET /api/auth/me', () => {
  it('should return the current user with a valid token', async () => {
    const user = await createTestUser();
    const token = generateToken(user._id);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
    expect(res.body.name).toBe(user.name);
  });

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token-here');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('should clear the token cookie', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');
    // Check that set-cookie header clears the token
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/token=;/);
  });
});
