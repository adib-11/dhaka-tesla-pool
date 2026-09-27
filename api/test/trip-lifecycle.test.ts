import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { goOnline, loginAs, poolNusratAndRafiq, requestRide, resetDb } from './helpers';

describe('trip lifecycle', () => {
  beforeEach(resetDb);

  it('locks Nusrat at ৳57 and Rafiq at ৳60 when the pooled trip starts', async () => {
    const { nusrat, rafiq, jashim, n, r, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    const started = await jashim.post(`/trips/${tripId}/start`).expect(200);
    expect(started.body.status).toBe('STARTED');

    const nRide = await nusrat.get(`/ride-requests/${n}`).expect(200);
    expect(nRide.body).toMatchObject({
      status: 'IN_PROGRESS',
      fare: { basePaisa: 3000, distanceChargePaisa: 4600, poolDiscountPaisa: 1900, finalFarePaisa: 5700 },
    });
    const rRide = await rafiq.get(`/ride-requests/${r}`).expect(200);
    expect(rRide.body.fare).toEqual({ basePaisa: 3000, distanceChargePaisa: 5000, poolDiscountPaisa: 2000, finalFarePaisa: 6000 });
  });

  it('charges the full ৳76 when Nusrat rides alone', async () => {
    const [nusrat, jashim] = await Promise.all([loginAs('nusrat'), loginAs('jashim')]);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali');
    const { body: trip } = await jashim.post(`/driver/requests/${n}/accept`).expect(200);
    await jashim.post(`/trips/${trip.id}/arrive`).expect(200);
    await jashim.post(`/trips/${trip.id}/start`).expect(200);
    expect((await nusrat.get(`/ride-requests/${n}`)).body.fare.finalFarePaisa).toBe(7600);
  });

  it('rejects invalid transitions with 409', async () => {
    const { jashim, n, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/start`).expect(409); // not arrived yet
    await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(409); // not started
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/arrive`).expect(409); // twice
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    await jashim.post(`/trips/${tripId}/cancel`).expect(409); // underway
  });

  it('lets Nusrat cancel before Jashim arrives, freeing her seat for others', async () => {
    const { nusrat, jashim, n, tripId } = await poolNusratAndRafiq();
    await nusrat.post(`/ride-requests/${n}/cancel`).expect(200);
    const trip = await jashim.get('/driver/trip').expect(200);
    expect(trip.body).toMatchObject({ id: tripId, status: 'ACCEPTED', seatsTaken: 1 });
    expect(trip.body.passengers.map((p: { passengerName: string }) => p.passengerName)).toEqual(['Rafiq']);
  });

  it('refuses cancellation once Jashim has arrived', async () => {
    const { nusrat, jashim, n, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await nusrat.post(`/ride-requests/${n}/cancel`).expect(409);
  });

  it('cancels the Trip when its last passenger cancels', async () => {
    const [nusrat, jashim] = await Promise.all([loginAs('nusrat'), loginAs('jashim')]);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali');
    const { body: trip } = await jashim.post(`/driver/requests/${n}/accept`).expect(200);
    await nusrat.post(`/ride-requests/${n}/cancel`).expect(200);
    expect((await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } })).status).toBe('CANCELLED');
    expect((await jashim.get('/driver/trip')).text).toBe('null');
  });

  it('requeues Nusrat and Rafiq when Jashim cancels, so Kamal can pick them up', async () => {
    const { jashim, n, r, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/cancel`).expect(200);
    const statuses = await prisma.rideRequest.findMany({ where: { id: { in: [n, r] } }, select: { status: true, tripId: true } });
    expect(statuses).toEqual([
      { status: 'REQUESTED', tripId: null },
      { status: 'REQUESTED', tripId: null },
    ]);
    const kamal = await loginAs('kamal');
    await goOnline(kamal, 'Banani');
    expect((await kamal.get('/driver/requests').expect(200)).body).toHaveLength(2);
  });

  it('completes the Trip after the last drop-off and parks Bullet at the last destination', async () => {
    const { jashim, n, r, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    const afterNusrat = await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(200);
    expect(afterNusrat.body.status).toBe('STARTED');
    await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(409); // twice
    const done = await jashim.post(`/trips/${tripId}/requests/${r}/drop-off`).expect(200);
    expect(done.body.status).toBe('COMPLETED');
    const me = await jashim.get('/auth/me').expect(200);
    const gulshan1 = await prisma.zone.findUniqueOrThrow({ where: { name: 'Gulshan 1' } });
    expect(me.body.tesla.currentZoneId).toBe(gulshan1.id);
  });

  it('completes the Trip exactly once when the last two drop-offs happen at the same instant', async () => {
    const { jashim, n, r, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    // Jashim on two devices, so the two drop-offs really are separate concurrent requests.
    const [phone, tablet] = await Promise.all([loginAs('jashim'), loginAs('jashim')]);

    const results = await Promise.all([
      phone.post(`/trips/${tripId}/requests/${n}/drop-off`),
      tablet.post(`/trips/${tripId}/requests/${r}/drop-off`),
    ]);

    expect(results.map((res) => res.status)).toEqual([200, 200]);
    const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
    expect(trip.status).toBe('COMPLETED');
    // The FOR UPDATE lock serialises the two drop-offs, so the Trip completes exactly once.
    expect(await prisma.rideEvent.count({ where: { tripId, type: 'TRIP_COMPLETED' } })).toBe(1);
    expect(await prisma.rideRequest.count({ where: { tripId, status: 'COMPLETED' } })).toBe(2);
  });

  it("stops Kamal from touching Jashim's trip", async () => {
    const { tripId } = await poolNusratAndRafiq();
    const kamal = await loginAs('kamal');
    await kamal.post(`/trips/${tripId}/arrive`).expect(404);
    await kamal.get(`/trips/${tripId}`).expect(404);
  });
});
