const request = require('supertest');
const { connectDB, clearDB, disconnectDB } = require('../setup');
const app = require('../../src/app');
const { createTestUser, generateToken } = require('../helpers');

// Mock the AI service module to avoid calling real Claude CLI
jest.mock('../../src/services/ai', () => ({
  chat: jest.fn().mockResolvedValue({
    response: 'This is a mock AI response.',
    conversationId: 'mock-conversation-id',
  }),
  planDay: jest.fn().mockResolvedValue({ plan: 'Mock plan' }),
  estimateDuration: jest.fn().mockResolvedValue({ duration: 30 }),
}));

beforeAll(connectDB);
afterEach(clearDB);
afterAll(disconnectDB);

let user, token;

beforeEach(async () => {
  user = await createTestUser();
  token = generateToken(user._id);
});

describe('POST /api/ai/chat', () => {
  it('should return a response for a valid message', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello AI' });

    expect(res.status).toBe(200);
    expect(res.body.response).toBe('This is a mock AI response.');
  });

  it('should reject without a message', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('message is required');
  });

  it('should reject unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'Hello' });

    expect(res.status).toBe(401);
  });
});
