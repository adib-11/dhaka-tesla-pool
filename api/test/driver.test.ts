import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { goOnline, loginAs, requestRide, resetDb, zoneId } from './helpers';

describe('driver dashboard', () => {
  beforeEach(resetDb);

  it("lists only requests waiting in Jashim's zone", async () => {
    const [nusrat, shirin, jashim] = await Promise.all([loginAs('nusrat'), loginAs('shirin'), loginAs('jashim')]);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali');
    await requestRide(shirin, 'Gulshan 1', 'Banani');
    const res = await jashim.get('/driver/requests').expect(200);
    expect(res.body).toEqual([expect.objectContaining({ id: n, passengerName: 'Nusrat', seats: 1, estimatedSoloPaisa: 7600 })]);
  });

  it('shows nothing while offline', async () => {
    const [nusrat, jashim] = await Promise.all([loginAs('nusrat'), loginAs('jashim')]);
    await requestRide(nusrat, 'Banani', 'Mohakhali');
    await jashim.patch('/driver/status').send({ isOnline: false, currentZoneId: await zoneId('Banani') }).expect(200);
    expect((await jashim.get('/driver/requests').expect(200)).body).toEqual([]);
  });

  it("hides a 3-seat request from Kamal's 2-seat Toofan but not from Bullet", async () => {
    const [rafiq, kamal, jashim] = await Promise.all([loginAs('rafiq'), loginAs('kamal'), loginAs('jashim')]);
    await goOnline(kamal, 'Banani');
    await requestRide(rafiq, 'Banani', 'Gulshan 1', { seats: 3 });
    expect((await kamal.get('/driver/requests').expect(200)).body).toEqual([]);
    expect((await jashim.get('/driver/requests').expect(200)).body).toHaveLength(1);
  });

  it('has no current trip before accepting anyone', async () => {
    const jashim = await loginAs('jashim');
    const res = await jashim.get('/driver/trip').expect(200);
    expect(res.text).toBe('null');
  });

  it('refuses to go offline while carrying an active Trip', async () => {
    const jashim = await loginAs('jashim');
    const driver = await prisma.user.findUniqueOrThrow({ where: { email: 'jashim@teslapool.dev' } });
    const tesla = await prisma.tesla.findUniqueOrThrow({ where: { driverId: driver.id } });
    await prisma.trip.create({
      data: { teslaId: tesla.id, driverId: driver.id, pickupZoneId: await zoneId('Banani'), capacity: tesla.capacity },
    });
    await jashim.patch('/driver/status').send({ isOnline: false, currentZoneId: await zoneId('Banani') }).expect(409);
    await jashim.patch('/driver/status').send({ isOnline: true, currentZoneId: await zoneId('Mohakhali') }).expect(409);
  });

  it('keeps passengers out of driver routes', async () => {
    const nusrat = await loginAs('nusrat');
    await nusrat.get('/driver/requests').expect(403);
    await nusrat.get('/trips').expect(403);
  });
});
