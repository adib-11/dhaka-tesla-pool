import request from 'supertest';
import { buildApp } from '../src/app';
import { prisma } from '../src/db';
import { seedBase, CAST, DEMO_PASSWORD } from '../prisma/seed-data';

export const app = buildApp();
export type Agent = ReturnType<typeof request.agent>;

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE ride_events, teslapay_transactions, ride_requests, trips, teslas, users, zones RESTART IDENTITY CASCADE',
  );
  await seedBase(prisma);
}

export async function zoneId(name: string) {
  return (await prisma.zone.findUniqueOrThrow({ where: { name } })).id;
}

export async function loginAs(who: keyof typeof CAST): Promise<Agent> {
  const agent = request.agent(app);
  await agent.post('/auth/login').send({ email: CAST[who].email, password: DEMO_PASSWORD }).expect(200);
  return agent;
}

export async function goOnline(agent: Agent, zone: string) {
  await agent.patch('/driver/status').send({ isOnline: true, currentZoneId: await zoneId(zone) }).expect(200);
}

export async function requestRide(agent: Agent, from: string, to: string, extra: Record<string, unknown> = {}) {
  const res = await agent
    .post('/ride-requests')
    .send({ pickupZoneId: await zoneId(from), dropoffZoneId: await zoneId(to), ...extra })
    .expect(201);
  return res.body.id as string;
}

/** The Banani story: Nusrat (to Mohakhali) and Rafiq (to Gulshan 1) share Bullet. */
export async function poolNusratAndRafiq(nusratExtra: Record<string, unknown> = {}) {
  const [nusrat, rafiq, jashim] = await Promise.all([loginAs('nusrat'), loginAs('rafiq'), loginAs('jashim')]);
  const n = await requestRide(nusrat, 'Banani', 'Mohakhali', nusratExtra);
  const r = await requestRide(rafiq, 'Banani', 'Gulshan 1');
  const trip = await jashim.post(`/driver/requests/${n}/accept`).expect(200);
  await jashim.post(`/driver/requests/${r}/accept`).expect(200);
  return { nusrat, rafiq, jashim, n, r, tripId: trip.body.id as string };
}
