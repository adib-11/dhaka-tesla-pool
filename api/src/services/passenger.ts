import { prisma } from '../db';
import { calculateFare } from '../domain/fare';
import { roadDistanceM } from '../domain/geo';
import { unprocessable } from '../http/errors';
import { zoneView } from './views';

/** The Estimated Fare for a prospective Ride Request: always both the solo and the "if pooled" figure. */
export async function estimateRide(pickupZoneId: number, dropoffZoneId: number, seats: number) {
  if (pickupZoneId === dropoffZoneId) throw unprocessable('Pickup and destination must be different zones');
  const zones = await prisma.zone.findMany({ where: { id: { in: [pickupZoneId, dropoffZoneId] } } });
  const pickup = zones.find((z) => z.id === pickupZoneId);
  const dropoff = zones.find((z) => z.id === dropoffZoneId);
  if (!pickup || !dropoff) throw unprocessable('Unknown zone');
  const distanceM = roadDistanceM(pickup, dropoff);
  return {
    pickup: zoneView(pickup),
    dropoff: zoneView(dropoff),
    distanceM,
    solo: calculateFare({ distanceM, seats, pooled: false }),
    pooled: calculateFare({ distanceM, seats, pooled: true }),
  };
}
