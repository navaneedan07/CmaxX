import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recallCustomer = vi.fn();
const retainForCustomer = vi.fn();
const listCustomerMemories = vi.fn();
const askGroq = vi.fn();

vi.mock('../services/hindsight.js', () => ({
  recallCustomer,
  retainForCustomer,
  listCustomerMemories,
}));

vi.mock('../services/groq.js', () => ({
  askGroq,
}));

const { chatRouter } = await import('../routes/chat.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/chat', chatRouter);
  return app;
}

describe('chat route reliability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recallCustomer.mockResolvedValue([]);
    listCustomerMemories.mockResolvedValue([]);
  });

  it('returns 400 when customerId is missing', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/chat')
      .send({ message: 'hello' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('customerId');
  });

  it('does not retain when memory is disabled', async () => {
    askGroq.mockResolvedValue({
      reply: 'Stateless response',
      retainData: {
        summary: 'customer asked for support',
        stage: 'adoption',
        health: 'engaged',
        newBlocker: null,
        blockerResolved: null,
        goalMentioned: null,
        goalAchieved: false,
      },
    });

    const app = createApp();
    const res = await request(app)
      .post('/chat')
      .send({ customerId: 'priya', message: 'help', useMemory: false, history: [] });

    expect(res.status).toBe(200);
    expect(res.body.memoryEnabled).toBe(false);
    expect(recallCustomer).not.toHaveBeenCalled();
    expect(retainForCustomer).not.toHaveBeenCalled();
  });

  it('drops malformed retain payload and skips retain', async () => {
    askGroq.mockResolvedValue({
      reply: 'Response with malformed retain',
      retainData: {
        stage: 'not-a-stage',
      },
    });

    const app = createApp();
    const res = await request(app)
      .post('/chat')
      .send({ customerId: 'priya', message: 'help', useMemory: true, history: [] });

    expect(res.status).toBe(200);
    expect(res.body.retainData).toBeNull();
    expect(retainForCustomer).not.toHaveBeenCalled();
  });

  it('retains normalized payload when valid retain data is returned', async () => {
    askGroq.mockResolvedValue({
      reply: 'All good',
      retainData: {
        summary: 'Customer resolved login blocker',
        stage: 'adoption',
        health: 'engaged',
        newBlocker: null,
        blockerResolved: 'SSO mismatch fixed',
        goalMentioned: 'Onboard all users',
        goalAchieved: false,
      },
    });

    const app = createApp();
    const res = await request(app)
      .post('/chat')
      .send({ customerId: 'james', message: 'done', useMemory: true, history: [] });

    expect(res.status).toBe(200);
    expect(res.body.retainData.summary).toBe('Customer resolved login blocker');
    expect(retainForCustomer).toHaveBeenCalledOnce();
    expect(retainForCustomer.mock.calls[0][2]).toEqual(
      expect.objectContaining({ stage: 'adoption', health: 'engaged' })
    );
  });
});
