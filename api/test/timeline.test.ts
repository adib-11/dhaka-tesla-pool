import { beforeEach, describe, expect, it } from 'vitest';
import { loginAs, poolNusratAndRafiq, resetDb } from './helpers';

type Ev = { type: string; actorName: string | null; detail: Record<string, unknown> | null };

describe('ride timeline', () => {
  beforeEach(resetDb);

  it("shows Nusrat her own events and shared trip events, but nothing from Rafiq's ride", async () => {
    const { nusrat, rafiq, jashim, n, r, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);

    const mine: Ev[] = (await nusrat.get(`/ride-requests/${n}`).expect(200)).body.events;
    expect(mine.map((e) => e.type)).toEqual(['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'STARTED', 'FARE_LOCKED']);
    expect(mine.every((e) => e.actorName !== 'Rafiq')).toBe(true);
    expect(mine.at(-1)!.detail).toMatchObject({ totalPaisa: 5700, pooled: true, passengersOnTrip: 2 });

    const his: Ev[] = (await rafiq.get(`/ride-requests/${r}`).expect(200)).body.events;
    expect(his.map((e) => e.type)).toEqual(['REQUESTED', 'JOINED_POOL', 'DRIVER_ARRIVED', 'STARTED', 'FARE_LOCKED']);
  });

  it('shows Jashim the whole trip', async () => {
    const { jashim, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    const trip = await jashim.get(`/trips/${tripId}`).expect(200);
    expect(trip.body.events.map((e: Ev) => e.type)).toEqual(['ACCEPTED', 'JOINED_POOL', 'DRIVER_ARRIVED']);
  });

  it("stops Nusrat's timeline at her own cancellation, even after Rafiq cancels the Trip", async () => {
    const { nusrat, rafiq, n, r } = await poolNusratAndRafiq();
    await nusrat.post(`/ride-requests/${n}/cancel`).expect(200);
    await rafiq.post(`/ride-requests/${r}/cancel`).expect(200);

    const mine: Ev[] = (await nusrat.get(`/ride-requests/${n}`).expect(200)).body.events;
    expect(mine.map((e) => e.type)).toEqual(['REQUESTED', 'ACCEPTED', 'CANCELLED']);
    expect(mine.every((e) => e.actorName !== 'Rafiq')).toBe(true);
  });

  it("hides another Passenger's timeline behind a 404", async () => {
    const { nusrat, r } = await poolNusratAndRafiq();
    await nusrat.get(`/ride-requests/${r}`).expect(404);
  });

  it("hides another Driver's trip timeline behind a 404", async () => {
    const { tripId } = await poolNusratAndRafiq();
    const kamal = await loginAs('kamal');
    await kamal.get(`/trips/${tripId}`).expect(404);
  });
});
