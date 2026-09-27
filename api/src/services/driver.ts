import type { Prisma, TripStatus } from '@prisma/client';
import { prisma } from '../db';
import { destinationsCompatible, isCompatible, type TripSnapshot } from '../domain/compatibility';
import { conflict, notFound, unprocessable } from '../http/errors';
import { recordEvent } from './events';
import { driverTripView, meView, tripInclude, zoneView } from './views';

export const ACTIVE_TRIP_STATUSES: TripStatus[] = ['ACCEPTED', 'DRIVER_ARRIVED', 'STARTED'];

function findActiveTrip(db: Prisma.TransactionClient, driverId: string) {
  return db.trip.findFirst({ where: { driverId, status: { in: ACTIVE_TRIP_STATUSES } }, include: tripInclude });
}

export async function setDriverStatus(driverId: string, input: { isOnline: boolean; currentZoneId: number }) {
  const [tesla, active, zone] = await Promise.all([
    prisma.tesla.findUniqueOrThrow({ where: { driverId } }),
    findActiveTrip(prisma, driverId),
    prisma.zone.findUnique({ where: { id: input.currentZoneId } }),
  ]);
  if (!zone) throw unprocessable('Unknown zone');
  if (active && (!input.isOnline || input.currentZoneId !== tesla.currentZoneId)) {
    throw conflict('Finish or cancel your current trip before going offline or changing zone');
  }
  await prisma.tesla.update({ where: { driverId }, data: input });
  return meView(driverId);
}

export async function getActiveTrip(driverId: string) {
  const trip = await findActiveTrip(prisma, driverId);
  return trip && driverTripView(trip);
}

export async function listCompatibleRequests(driverId: string) {
  const tesla = await prisma.tesla.findUniqueOrThrow({ where: { driverId } });
  if (!tesla.isOnline || tesla.currentZoneId === null) return [];
  const trip = await findActiveTrip(prisma, driverId);
  const snapshot: TripSnapshot = trip
    ? {
        status: trip.status,
        pickupZoneId: trip.pickupZoneId,
        capacity: trip.capacity,
        seatsTaken: trip.seatsTaken,
        isSolo: trip.isSolo,
        destinations: trip.requests.filter((r) => r.status === 'MATCHED').map((r) => r.dropoffZone),
      }
    : { status: 'ACCEPTED', pickupZoneId: tesla.currentZoneId, capacity: tesla.capacity, seatsTaken: 0, isSolo: false, destinations: [] };

  const waiting = await prisma.rideRequest.findMany({
    where: { status: 'REQUESTED', pickupZoneId: snapshot.pickupZoneId },
    include: { passenger: { select: { name: true } }, pickupZone: true, dropoffZone: true },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });
  return waiting
    .filter((r) => isCompatible(snapshot, { pickupZoneId: r.pickupZoneId, seats: r.seats, allowSharing: r.allowSharing, dropoff: r.dropoffZone }))
    .map((r) => ({
      id: r.id,
      passengerName: r.passenger.name,
      pickup: zoneView(r.pickupZone),
      dropoff: zoneView(r.dropoffZone),
      seats: r.seats,
      allowSharing: r.allowSharing,
      distanceM: r.distanceM,
      estimatedSoloPaisa: r.estimatedSoloPaisa,
      createdAt: r.createdAt,
    }));
}

export async function getDriverTrip(driverId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, driverId }, include: tripInclude });
  if (!trip) throw notFound('Trip not found');
  return driverTripView(trip);
}

export async function listDriverTrips(driverId: string) {
  const trips = await prisma.trip.findMany({ where: { driverId }, include: tripInclude, orderBy: { createdAt: 'desc' }, take: 50 });
  return trips.map(driverTripView);
}

export async function acceptRideRequest(driverId: string, requestId: string) {
  const tripId = await prisma.$transaction(async (tx) => {
    const tesla = await tx.tesla.findUniqueOrThrow({ where: { driverId } });
    if (!tesla.isOnline) throw conflict('Go online before accepting rides');
    const ride = await tx.rideRequest.findUnique({ where: { id: requestId }, include: { dropoffZone: true } });
    if (!ride) throw notFound('Ride request not found');
    if (ride.pickupZoneId !== tesla.currentZoneId) throw conflict('This passenger is not in your current zone');

    // Reuse the Driver's active Trip or open one. With trips_one_active_per_driver,
    // a concurrent second INSERT waits for the first and then does nothing.
    await tx.$executeRaw`
      INSERT INTO trips (tesla_id, driver_id, pickup_zone_id, capacity)
      VALUES (${tesla.id}::uuid, ${driverId}::uuid, ${ride.pickupZoneId}, ${tesla.capacity})
      ON CONFLICT (driver_id) WHERE status IN ('ACCEPTED', 'DRIVER_ARRIVED', 'STARTED') DO NOTHING`;
    const trip = await tx.trip.findFirstOrThrow({ where: { driverId, status: { in: ACTIVE_TRIP_STATUSES } } });

    // Conditional flip: if another Driver got here first, zero rows change.
    const taken = await tx.rideRequest.updateMany({
      where: { id: requestId, status: 'REQUESTED' },
      data: { status: 'MATCHED', tripId: trip.id, matchedAt: new Date() },
    });
    if (taken.count === 0) throw conflict('This ride was already taken or cancelled');

    // ADR 0001: one conditional UPDATE checks and claims the seats atomically, and locks the Trip row.
    const claimed = await tx.$queryRaw<{ seats_taken: number }[]>`
      UPDATE trips
         SET seats_taken = seats_taken + ${ride.seats},
             is_solo     = is_solo OR ${!ride.allowSharing}
       WHERE id = ${trip.id}::uuid
         AND status = 'ACCEPTED'
         AND pickup_zone_id = ${ride.pickupZoneId}
         AND seats_taken + ${ride.seats} <= capacity
         AND (seats_taken = 0 OR (NOT is_solo AND ${ride.allowSharing}))
       RETURNING seats_taken`;
    if (claimed.length === 0) {
      throw conflict(`${tesla.name} cannot take this ride: not enough free seats, a solo ride, or the trip is already underway`);
    }

    // Checked after the claim: every Accept takes this same seat UPDATE first, so a competing
    // Accept on this Trip is blocked on the row lock until we commit and cannot slip in unseen.
    const others = await tx.rideRequest.findMany({
      where: { tripId: trip.id, status: 'MATCHED', id: { not: requestId } },
      include: { dropoffZone: true },
    });
    if (!destinationsCompatible(others.map((o) => o.dropoffZone), ride.dropoffZone)) {
      throw conflict('Destination is too far from the other passengers on this trip');
    }

    await recordEvent(tx, {
      type: others.length ? 'JOINED_POOL' : 'ACCEPTED',
      tripId: trip.id,
      rideRequestId: requestId,
      actorUserId: driverId,
      fromStatus: 'REQUESTED',
      toStatus: 'MATCHED',
      detail: { seatsTaken: claimed[0].seats_taken, capacity: trip.capacity },
    });
    return trip.id;
  });
  return getDriverTrip(driverId, tripId);
}
