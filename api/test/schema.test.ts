import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { CAST } from '../prisma/seed-data';
import { resetDb, zoneId } from './helpers';

const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } });

describe('database safety rules', () => {
  beforeEach(resetDb);

  it('refuses a Tesla outside the 1-6 seat range', async () => {
    const jashim = await user(CAST.jashim.email);
    await expect(prisma.tesla.update({ where: { driverId: jashim.id }, data: { capacity: 7 } })).rejects.toThrow(
      /teslas_capacity_range/,
    );
  });

  it("refuses a Trip carrying more seats than the Tesla's capacity", async () => {
    const jashim = await user(CAST.jashim.email);
    const bullet = await prisma.tesla.findUniqueOrThrow({ where: { driverId: jashim.id } });
    await expect(
      prisma.trip.create({
        data: { teslaId: bullet.id, driverId: jashim.id, pickupZoneId: await zoneId('Banani'), capacity: 3, seatsTaken: 4 },
      }),
    ).rejects.toThrow(/trips_seats_within_capacity/);
  });

  it('refuses a Ride Request outside the 1-3 seat range', async () => {
    const nusrat = await user(CAST.nusrat.email);
    await expect(
      prisma.rideRequest.create({
        data: {
          passengerId: nusrat.id,
          pickupZoneId: await zoneId('Banani'),
          dropoffZoneId: await zoneId('Mohakhali'),
          seats: 4,
          distanceM: 2300,
          estimatedSoloPaisa: 7600,
        },
      }),
    ).rejects.toThrow(/ride_requests_seats_range/);
  });

  it('refuses a Ride Request whose pickup is its own destination', async () => {
    const nusrat = await user(CAST.nusrat.email);
    const banani = await zoneId('Banani');
    await expect(
      prisma.rideRequest.create({
        data: { passengerId: nusrat.id, pickupZoneId: banani, dropoffZoneId: banani, seats: 1, distanceM: 0, estimatedSoloPaisa: 7600 },
      }),
    ).rejects.toThrow(/ride_requests_distinct_zones/);
  });

  it('allows only one active Ride Request per Passenger', async () => {
    const nusrat = await user(CAST.nusrat.email);
    const ride = {
      passengerId: nusrat.id,
      pickupZoneId: await zoneId('Banani'),
      dropoffZoneId: await zoneId('Mohakhali'),
      seats: 1,
      distanceM: 2300,
      estimatedSoloPaisa: 7600,
    };
    const first = await prisma.rideRequest.create({ data: ride });
    await expect(prisma.rideRequest.create({ data: ride })).rejects.toMatchObject({ code: 'P2002' });

    // The index is partial: once her first ride is no longer active, Nusrat can request again.
    await prisma.rideRequest.update({ where: { id: first.id }, data: { status: 'CANCELLED' } });
    await expect(prisma.rideRequest.create({ data: ride })).resolves.toMatchObject({ status: 'REQUESTED' });
  });

  it('allows only one active Trip per Driver', async () => {
    const jashim = await user(CAST.jashim.email);
    const bullet = await prisma.tesla.findUniqueOrThrow({ where: { driverId: jashim.id } });
    const trip = { teslaId: bullet.id, driverId: jashim.id, pickupZoneId: await zoneId('Banani'), capacity: 3 };
    const first = await prisma.trip.create({ data: trip });
    await expect(prisma.trip.create({ data: trip })).rejects.toMatchObject({ code: 'P2002' });

    // The index is partial: a cancelled Trip does not block the next one.
    await prisma.trip.update({ where: { id: first.id }, data: { status: 'CANCELLED' } });
    await expect(prisma.trip.create({ data: trip })).resolves.toMatchObject({ status: 'ACCEPTED' });
  });
});
