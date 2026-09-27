import request from 'supertest';
import { buildApp } from '../src/app';
import { prisma } from '../src/db';
import { seedBase } from '../prisma/seed-data';

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
