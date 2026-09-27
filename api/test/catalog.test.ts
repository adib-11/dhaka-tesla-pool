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

  it("estimates Rafiq's ride from Banani to Gulshan 1", async () => {
    const res = await request(app)
      .get('/fare-estimate')
      .query({ from: await zoneId('Banani'), to: await zoneId('Gulshan 1'), seats: 1 })
      .expect(200);
    expect(res.body).toMatchObject({ distanceM: 2500, solo: { totalPaisa: 8000 }, pooled: { totalPaisa: 6000 } });
  });

  it('rejects the same pickup and destination', async () => {
    const banani = await zoneId('Banani');
    await request(app).get('/fare-estimate').query({ from: banani, to: banani }).expect(422);
  });

  it('rejects seats outside the 1-3 range', async () => {
    const from = await zoneId('Banani');
    const to = await zoneId('Uttara');
    for (const seats of [0, -1, 1.5, 4]) {
      await request(app).get('/fare-estimate').query({ from, to, seats }).expect(422);
    }
  });
});
