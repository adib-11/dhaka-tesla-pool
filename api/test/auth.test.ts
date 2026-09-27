import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { CAST } from '../prisma/seed-data';
import { app, loginAs, resetDb } from './helpers';

describe('auth', () => {
  beforeEach(resetDb);

  it('signs Nabila up as a Passenger and keeps her signed in', async () => {
    const nabila = request.agent(app);
    const res = await nabila
      .post('/auth/signup')
      .send({ name: 'Nabila', email: 'nabila@teslapool.dev', password: 'nusrats-sister' })
      .expect(201);
    expect(res.body).toMatchObject({ name: 'Nabila', role: 'PASSENGER', tesla: null });
    const me = await nabila.get('/auth/me').expect(200);
    expect(me.body.email).toBe('nabila@teslapool.dev');
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it("rejects signing up with Nusrat's email again", async () => {
    await request(app)
      .post('/auth/signup')
      .send({ name: 'Imposter', email: CAST.nusrat.email, password: 'whatever123' })
      .expect(409);
  });

  it('rejects a wrong password with the same message as an unknown email', async () => {
    const wrong = await request(app).post('/auth/login').send({ email: CAST.rafiq.email, password: 'not-his-password' }).expect(401);
    const unknown = await request(app).post('/auth/login').send({ email: 'ghost@teslapool.dev', password: 'not-his-password' }).expect(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it('rejects requests without a session', async () => {
    await request(app).get('/auth/me').expect(401);
  });

  it('returns Jashim with his Tesla', async () => {
    const jashim = await loginAs('jashim');
    const me = await jashim.get('/auth/me').expect(200);
    expect(me.body).toMatchObject({ role: 'DRIVER', tesla: { name: 'Bullet', capacity: 3, isOnline: true } });
  });

  it('logs out', async () => {
    const shirin = await loginAs('shirin');
    await shirin.post('/auth/logout').expect(204);
    await shirin.get('/auth/me').expect(401);
  });
});
