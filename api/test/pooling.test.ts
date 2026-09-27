import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { goOnline, loginAs, poolNusratAndRafiq, requestRide, resetDb } from './helpers';

describe('pooling Bullet', () => {
  beforeEach(resetDb);

  it('puts Nusrat and Rafiq on one Trip with 2 of 3 seats taken', async () => {
    const { jashim, tripId } = await poolNusratAndRafiq();
    const trip = await jashim.get('/driver/trip').expect(200);
    expect(trip.body).toMatchObject({ id: tripId, status: 'ACCEPTED', seatsTaken: 2, capacity: 3 });
    expect(trip.body.passengers.map((p: { passengerName: string }) => p.passengerName)).toEqual(['Nusrat', 'Rafiq']);
  });

  it("shows Nusrat she is sharing, without Rafiq's name or fare", async () => {
    const { nusrat, n } = await poolNusratAndRafiq();
    const ride = await nusrat.get(`/ride-requests/${n}`).expect(200);
    expect(ride.body.status).toBe('MATCHED');
    expect(ride.body.trip).toEqual({ status: 'ACCEPTED', driverName: 'Jashim', teslaName: 'Bullet', plate: expect.any(String), coRiders: 1 });
    expect(JSON.stringify(ride.body)).not.toContain('Rafiq');
  });

  it('records a Ride Event for every Accept in the same transaction', async () => {
    const { tripId } = await poolNusratAndRafiq();
    const jashim = await prisma.user.findUniqueOrThrow({ where: { email: 'jashim@teslapool.dev' } });
    const events = await prisma.rideEvent.findMany({ where: { tripId }, orderBy: { id: 'asc' } });
    expect(events.map((e) => ({ type: e.type, from: e.fromStatus, to: e.toStatus }))).toEqual([
      { type: 'ACCEPTED', from: 'REQUESTED', to: 'MATCHED' },
      { type: 'JOINED_POOL', from: 'REQUESTED', to: 'MATCHED' },
    ]);
    expect(events.every((e) => e.actorUserId === jashim.id)).toBe(true);
  });

  it("never seats more passengers than Bullet's 3 seats", async () => {
    const [rafiq, nusrat, jashim] = await Promise.all([loginAs('rafiq'), loginAs('nusrat'), loginAs('jashim')]);
    const r = await requestRide(rafiq, 'Banani', 'Gulshan 1', { seats: 2 });
    await jashim.post(`/driver/requests/${r}/accept`).expect(200);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali', { seats: 2 });
    expect((await jashim.get('/driver/requests').expect(200)).body).toEqual([]);
    await jashim.post(`/driver/requests/${n}/accept`).expect(409);
    const trip = await prisma.trip.findFirstOrThrow();
    expect(trip.seatsTaken).toBe(2);
  });

  it('lets exactly one of Nusrat and Shirin take the last seat when both are accepted at the same instant', async () => {
    const [rafiq, nusrat, shirin] = await Promise.all([loginAs('rafiq'), loginAs('nusrat'), loginAs('shirin')]);
    // Jashim on two devices, so the two accepts really are separate concurrent requests.
    const [phone, tablet] = await Promise.all([loginAs('jashim'), loginAs('jashim')]);
    const r = await requestRide(rafiq, 'Banani', 'Gulshan 1', { seats: 2 });
    await phone.post(`/driver/requests/${r}/accept`).expect(200);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali');
    const s = await requestRide(shirin, 'Banani', 'Gulshan 2');

    const results = await Promise.all([phone.post(`/driver/requests/${n}/accept`), tablet.post(`/driver/requests/${s}/accept`)]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    const trip = await prisma.trip.findFirstOrThrow();
    expect(trip.seatsTaken).toBe(3);
    expect(await prisma.rideRequest.count({ where: { tripId: trip.id, status: 'MATCHED' } })).toBe(2);
    expect(await prisma.rideRequest.count({ where: { status: 'REQUESTED' } })).toBe(1);
  });

  it("lets only one Driver take Nusrat's request when Jashim and Kamal race", async () => {
    const [nusrat, jashim, kamal] = await Promise.all([loginAs('nusrat'), loginAs('jashim'), loginAs('kamal')]);
    await goOnline(kamal, 'Banani');
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali');

    const results = await Promise.all([jashim.post(`/driver/requests/${n}/accept`), kamal.post(`/driver/requests/${n}/accept`)]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    // Only the winner committed: one Trip, Nusrat on it, and one ACCEPTED event (the loser's rolled back).
    const trips = await prisma.trip.findMany();
    expect(trips).toHaveLength(1);
    expect(await prisma.rideRequest.findUniqueOrThrow({ where: { id: n } })).toMatchObject({ status: 'MATCHED', tripId: trips[0].id });
    expect(await prisma.rideEvent.count({ where: { type: 'ACCEPTED' } })).toBe(1);
  });

  it('keeps a Solo Request alone', async () => {
    const [nusrat, rafiq, jashim] = await Promise.all([loginAs('nusrat'), loginAs('rafiq'), loginAs('jashim')]);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali', { allowSharing: false });
    await jashim.post(`/driver/requests/${n}/accept`).expect(200);
    const r = await requestRide(rafiq, 'Banani', 'Gulshan 1');
    await jashim.post(`/driver/requests/${r}/accept`).expect(409);
  });

  it('never lets a Solo Request join an existing Pool', async () => {
    const { jashim } = await poolNusratAndRafiq();
    const shirin = await loginAs('shirin');
    // Bullet has one free seat and the destination fits; only the Solo rule turns her away.
    const s = await requestRide(shirin, 'Banani', 'Mohakhali', { allowSharing: false });
    expect((await jashim.get('/driver/requests').expect(200)).body).toEqual([]);
    await jashim.post(`/driver/requests/${s}/accept`).expect(409);
  });

  it('refuses to pool destinations more than 3 km apart', async () => {
    const [nusrat, shirin, jashim] = await Promise.all([loginAs('nusrat'), loginAs('shirin'), loginAs('jashim')]);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali');
    await jashim.post(`/driver/requests/${n}/accept`).expect(200);
    const s = await requestRide(shirin, 'Banani', 'Uttara');
    await jashim.post(`/driver/requests/${s}/accept`).expect(409);
  });

  it('has the database itself reject a capacity breach', async () => {
    const { tripId } = await poolNusratAndRafiq();
    await expect(prisma.trip.update({ where: { id: tripId }, data: { seatsTaken: 4 } })).rejects.toThrow(/trips_seats_within_capacity/);
  });
});
