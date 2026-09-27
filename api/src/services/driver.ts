import type { Prisma, TripStatus } from '@prisma/client';
import { prisma } from '../db';
import { isCompatible, type TripSnapshot } from '../domain/compatibility';
import { conflict, notFound, unprocessable } from '../http/errors';
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
