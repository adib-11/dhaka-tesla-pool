import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { unauthorized } from '../http/errors';

export const zoneView = (z: { id: number; name: string }) => ({ id: z.id, name: z.name });

export async function meView(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, include: { tesla: true } });
  // A valid cookie can outlive the user row (seed reset, account deleted): that is a 401, not a 500.
  if (!u) throw unauthorized('Session expired, please sign in again');
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    teslapayBalancePaisa: u.teslapayBalancePaisa,
    tesla: u.tesla && {
      id: u.tesla.id,
      name: u.tesla.name,
      plate: u.tesla.plate,
      capacity: u.tesla.capacity,
      isOnline: u.tesla.isOnline,
      currentZoneId: u.tesla.currentZoneId,
    },
  };
}

export const rideInclude = {
  pickupZone: true,
  dropoffZone: true,
  trip: { include: { tesla: true, driver: { select: { name: true } } } },
} satisfies Prisma.RideRequestInclude;

type RideWithRelations = Prisma.RideRequestGetPayload<{ include: typeof rideInclude }>;

/** What one Passenger may see about their own ride: never other passengers' names or fares. */
export function passengerRideView(r: RideWithRelations, coRiders: number | null) {
  return {
    id: r.id,
    status: r.status,
    seats: r.seats,
    allowSharing: r.allowSharing,
    paymentMethod: r.paymentMethod,
    pickup: zoneView(r.pickupZone),
    dropoff: zoneView(r.dropoffZone),
    distanceM: r.distanceM,
    estimatedSoloPaisa: r.estimatedSoloPaisa,
    fare:
      r.finalFarePaisa === null
        ? null
        : {
            basePaisa: r.baseFarePaisa!,
            distanceChargePaisa: r.distanceChargePaisa!,
            poolDiscountPaisa: r.poolDiscountPaisa!,
            finalFarePaisa: r.finalFarePaisa,
          },
    paidAt: r.paidAt,
    createdAt: r.createdAt,
    trip: r.trip && {
      status: r.trip.status,
      driverName: r.trip.driver.name,
      teslaName: r.trip.tesla.name,
      plate: r.trip.tesla.plate,
      coRiders,
    },
  };
}
