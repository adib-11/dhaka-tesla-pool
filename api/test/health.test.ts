import request from 'supertest';
import { describe, it } from 'vitest';
import { app } from './helpers';

describe('GET /health', () => {
  it('reports ok when the database answers', async () => {
    await request(app).get('/health').expect(200, { status: 'ok' });
  });

  it('returns JSON 404 for unknown routes', async () => {
    await request(app).get('/nope').expect(404, { error: 'Route not found' });
  });
});
