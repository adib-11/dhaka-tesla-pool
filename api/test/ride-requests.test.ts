import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { loginAs, requestRide, resetDb, zoneId } from './helpers';

/** Puts a fresh Ride Request onto a Trip in the given status, standing in for the Driver accepting it. */
async function matchRide(rideId: string, tripStatus: 'ACCEPTED' | 'DRIVER_ARRIVED') {
  const ride = await prisma.rideRequest.findUniqueOrThrow({ where: { id: rideId } });
  const jashim = await prisma.user.findUniqueOrThrow({ where: { email: 'jashim@teslapool.dev' }, include: { tesla: true } });
  const trip = await prisma.trip.create({
    data: {
      teslaId: jashim.tesla!.id,
      driverId: jashim.id,
      pickupZoneId: ride.pickupZoneId,
      status: tripStatus,
      capacity: jashim.tesla!.capacity,
      seatsTaken: ride.seats,
      arrivedAt: tripStatus === 'DRIVER_ARRIVED' ? new Date() : null,
    },
  });
  await prisma.rideRequest.update({ where: { id: rideId }, data: { status: 'MATCHED', tripId: trip.id, matchedAt: new Date() } });
  return trip;
}

describe('ride requests', () => {
  beforeEach(resetDb);

  it('lets Nusrat request Banani → Mohakhali and see her own estimate', async () => {
    const nusrat = await loginAs('nusrat');
    const id = await requestRide(nusrat, 'Banani', 'Mohakhali');
    const res = await nusrat.get(`/ride-requests/${id}`).expect(200);
    expect(res.body).toMatchObject({
      status: 'REQUESTED',
      seats: 1,
      allowSharing: true,
      pickup: { name: 'Banani' },
      dropoff: { name: 'Mohakhali' },
      distanceM: 2300,
      estimatedSoloPaisa: 7600,
      fare: null,
      trip: null,
    });
  });

  it('records a Ride Event in the same transaction as the request', async () => {
    const nusrat = await loginAs('nusrat');
    const id = await requestRide(nusrat, 'Banani', 'Mohakhali');
    const events = await prisma.rideEvent.findMany({ where: { rideRequestId: id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'REQUESTED', toStatus: 'REQUESTED', fromStatus: null });
  });

  it('refuses a second active ride for Nusrat', async () => {
    const nusrat = await loginAs('nusrat');
    await requestRide(nusrat, 'Banani', 'Mohakhali');
    await nusrat.post('/ride-requests').send({ pickupZoneId: await zoneId('Banani'), dropoffZoneId: await zoneId('Uttara') }).expect(409);
  });

  it('rejects the same pickup and destination, and four seats', async () => {
    const nusrat = await loginAs('nusrat');
    const banani = await zoneId('Banani');
    await nusrat.post('/ride-requests').send({ pickupZoneId: banani, dropoffZoneId: banani }).expect(422);
    await nusrat.post('/ride-requests').send({ pickupZoneId: banani, dropoffZoneId: await zoneId('Uttara'), seats: 4 }).expect(422);
  });

  it("hides Nusrat's ride from Rafiq: he can neither see nor cancel it", async () => {
    const [nusrat, rafiq] = await Promise.all([loginAs('nusrat'), loginAs('rafiq')]);
    const id = await requestRide(nusrat, 'Banani', 'Mohakhali');
    await rafiq.get(`/ride-requests/${id}`).expect(404);
    await rafiq.post(`/ride-requests/${id}/cancel`).expect(404);
    const list = await rafiq.get('/ride-requests').expect(200);
    expect(list.body).toEqual([]);
  });

  it('lets Nusrat cancel while waiting, then request again', async () => {
    const nusrat = await loginAs('nusrat');
    const id = await requestRide(nusrat, 'Banani', 'Mohakhali');
    const res = await nusrat.post(`/ride-requests/${id}/cancel`).expect(200);
    expect(res.body.status).toBe('CANCELLED');
    await nusrat.post(`/ride-requests/${id}/cancel`).expect(409);
    await requestRide(nusrat, 'Banani', 'Mohakhali');

    const events = await prisma.rideEvent.findMany({ where: { rideRequestId: id } });
    expect(events.map((e) => e.type)).toEqual(['REQUESTED', 'CANCELLED']);
    expect(events[1]).toMatchObject({ fromStatus: 'REQUESTED', toStatus: 'CANCELLED', actorUserId: expect.any(String) });
  });

  it('still lets Nusrat cancel once her ride is Accepted, and frees the seats', async () => {
    const nusrat = await loginAs('nusrat');
    const id = await requestRide(nusrat, 'Banani', 'Mohakhali');
    const trip = await matchRide(id, 'ACCEPTED');
    const res = await nusrat.post(`/ride-requests/${id}/cancel`).expect(200);
    expect(res.body.status).toBe('CANCELLED');
    const after = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } });
    expect(after).toMatchObject({ seatsTaken: 0, status: 'CANCELLED' });
  });

  it('refuses cancellation with 409 once the Driver has arrived', async () => {
    const nusrat = await loginAs('nusrat');
    const id = await requestRide(nusrat, 'Banani', 'Mohakhali');
    await matchRide(id, 'DRIVER_ARRIVED');
    await nusrat.post(`/ride-requests/${id}/cancel`).expect(409);
  });

  it('keeps Jashim out of passenger routes and returns 404 for malformed ids', async () => {
    const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
    await jashim.post('/ride-requests').send({}).expect(403);
    await nusrat.get('/ride-requests/not-a-uuid').expect(404);
  });
});
