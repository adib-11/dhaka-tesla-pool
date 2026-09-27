import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, resetDb, zoneId } from './helpers';

describe('catalog', () => {
  beforeEach(resetDb);

  it('lists the Dhaka zones', async () => {
    const res = await request(app).get('/zones').expect(200);
    expect(res.body.map((z: { name: string }) => z.name)).toContain('Banani');
  });

  it("estimates Nusrat's ride from Banani to Mohakhali", async () => {
    const res = await request(app)
      .get('/fare-estimate')
      .query({ from: await zoneId('Banani'), to: await zoneId('Mohakhali'), seats: 1 })
      .expect(200);
    expect(res.body).toMatchObject({ distanceM: 2300, solo: { totalPaisa: 7600 }, pooled: { totalPaisa: 5700 } });
  });

  it('rejects the same pickup and destination', async () => {
    const banani = await zoneId('Banani');
    await request(app).get('/fare-estimate').query({ from: banani, to: banani }).expect(422);
  });

  it('rejects four seats', async () => {
    await request(app).get('/fare-estimate').query({ from: await zoneId('Banani'), to: await zoneId('Uttara'), seats: 4 }).expect(422);
  });
});
