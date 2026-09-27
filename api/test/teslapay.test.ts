import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { STARTING_BALANCE_PAISA } from '../prisma/seed-data';
import { prisma } from '../src/db';
import { settlePayment } from '../src/services/payments';
import { app, loginAs, poolNusratAndRafiq, resetDb, zoneId } from './helpers';

const nusratBalance = async (agent: Awaited<ReturnType<typeof loginAs>>) => (await agent.get('/auth/me').expect(200)).body.teslapayBalancePaisa;

describe('TeslaPay', () => {
  beforeEach(resetDb);

  it("charges Nusrat's ৳57 at drop-off and writes one ledger row", async () => {
    const { nusrat, jashim, n, tripId } = await poolNusratAndRafiq({ paymentMethod: 'TESLAPAY' });
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(200);

    expect(await nusratBalance(nusrat)).toBe(STARTING_BALANCE_PAISA - 5700);
    const ledger = await prisma.teslapayTransaction.findMany({ where: { rideRequestId: n } });
    expect(ledger).toEqual([expect.objectContaining({ type: 'RIDE_CHARGE', amountPaisa: -5700, balanceAfterPaisa: STARTING_BALANCE_PAISA - 5700 })]);
  });

  it('charges the Final Fare exactly once, even when the drop-off is retried', async () => {
    const { nusrat, jashim, n, tripId } = await poolNusratAndRafiq({ paymentMethod: 'TESLAPAY' });
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(200);
    await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(409);

    expect(await prisma.teslapayTransaction.count({ where: { rideRequestId: n } })).toBe(1);
    expect(await nusratBalance(nusrat)).toBe(STARTING_BALANCE_PAISA - 5700);
  });

  it('cannot charge the same ride twice even if settlement runs again', async () => {
    const { nusrat, jashim, n, tripId } = await poolNusratAndRafiq({ paymentMethod: 'TESLAPAY' });
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(200);

    const ride = await prisma.rideRequest.findUniqueOrThrow({ where: { id: n } });
    const driverId = (await prisma.user.findUniqueOrThrow({ where: { email: 'jashim@teslapool.dev' } })).id;
    // The @@unique([rideRequestId, type]) guard is the backstop, so the charge rolls back with no double debit.
    await expect(prisma.$transaction((tx) => settlePayment(tx, ride, driverId))).rejects.toThrow();

    expect(await prisma.teslapayTransaction.count({ where: { rideRequestId: n } })).toBe(1);
    expect(await nusratBalance(nusrat)).toBe(STARTING_BALANCE_PAISA - 5700);
  });

  it('leaves cash riders untouched', async () => {
    const { rafiq, jashim, r, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    await jashim.post(`/trips/${tripId}/requests/${r}/drop-off`).expect(200);

    expect(await nusratBalance(rafiq)).toBe(STARTING_BALANCE_PAISA);
    expect(await prisma.teslapayTransaction.count({ where: { rideRequestId: r } })).toBe(0);
  });

  it('refuses a TeslaPay request larger than the balance', async () => {
    const shirin = await loginAs('shirin');
    await prisma.user.update({ where: { email: 'shirin@teslapool.dev' }, data: { teslapayBalancePaisa: 1000 } });
    const res = await shirin
      .post('/ride-requests')
      .send({ pickupZoneId: await zoneId('Banani'), dropoffZoneId: await zoneId('Uttara'), paymentMethod: 'TESLAPAY' })
      .expect(422);
    expect(res.body.error).toBe('Not enough TeslaPay balance for this ride; choose cash instead');
  });

  it('falls back to cash when the balance drops below the fare before drop-off', async () => {
    const { nusrat, jashim, n, tripId } = await poolNusratAndRafiq({ paymentMethod: 'TESLAPAY' });
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    await prisma.user.update({ where: { email: 'nusrat@teslapool.dev' }, data: { teslapayBalancePaisa: 0 } });
    await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(200);

    expect(await prisma.teslapayTransaction.count({ where: { rideRequestId: n } })).toBe(0);
    expect((await prisma.rideRequest.findUniqueOrThrow({ where: { id: n } })).paymentMethod).toBe('CASH');
    const paid = await prisma.rideEvent.findFirstOrThrow({ where: { rideRequestId: n, type: 'PAID' } });
    expect(paid.detail).toMatchObject({ method: 'CASH', amountPaisa: 5700, fellBackToCash: true });
  });

  it('gives Nabila a ৳500 welcome credit on signup', async () => {
    const res = await request(app).post('/auth/signup').send({ name: 'Nabila', email: 'nabila@teslapool.dev', password: 'nusrats-sister' }).expect(201);
    expect(res.body.teslapayBalancePaisa).toBe(50_000);
    expect(await prisma.teslapayTransaction.count({ where: { userId: res.body.id, type: 'TOP_UP' } })).toBe(1);
  });

  it('shows Nusrat her balance and ledger, and the rows always sum to the balance', async () => {
    const { nusrat, jashim, n, tripId } = await poolNusratAndRafiq({ paymentMethod: 'TESLAPAY' });
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(200);

    const ledger = await nusrat.get('/teslapay').expect(200);
    expect(ledger.body.balancePaisa).toBe(STARTING_BALANCE_PAISA - 5700);
    const rows = ledger.body.entries as { type: string; amountPaisa: number; ride: unknown }[];
    expect(rows.map((e) => e.type)).toEqual(['RIDE_CHARGE', 'TOP_UP']);
    expect(rows.reduce((sum, e) => sum + e.amountPaisa, 0)).toBe(ledger.body.balancePaisa);
    expect(rows[0]).toMatchObject({ amountPaisa: -5700, ride: { pickup: { name: 'Banani' }, dropoff: { name: 'Mohakhali' } } });
    expect(rows[1]).toMatchObject({ amountPaisa: STARTING_BALANCE_PAISA, ride: null });
  });

  it('keeps every seeded balance equal to the sum of its ledger rows', async () => {
    const passengers = await prisma.user.findMany({ where: { role: 'PASSENGER' }, include: { teslapayTransactions: true } });
    expect(passengers).not.toHaveLength(0);
    for (const p of passengers) {
      expect(p.teslapayBalancePaisa).toBe(p.teslapayTransactions.reduce((sum, t) => sum + t.amountPaisa, 0));
    }
  });
});
