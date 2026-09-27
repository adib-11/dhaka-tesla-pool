import type { PaymentMethod } from '@prisma/client';
import { prisma } from '../db';
import { calculateFare } from '../domain/fare';
import { roadDistanceM } from '../domain/geo';
import { canMoveRequest } from '../domain/transitions';
import { conflict, isUniqueViolation, notFound, unprocessable } from '../http/errors';
import { recordEvent } from './events';
import { passengerRideView, rideInclude, zoneView } from './views';

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

export type NewRideRequest = {
  pickupZoneId: number;
  dropoffZoneId: number;
  seats: number;
  allowSharing: boolean;
  paymentMethod: PaymentMethod;
};

export async function createRideRequest(passengerId: string, input: NewRideRequest) {
  const estimate = await estimateRide(input.pickupZoneId, input.dropoffZoneId, input.seats);
  const id = await prisma.$transaction(async (tx) => {
    if (input.paymentMethod === 'TESLAPAY') {
      // The solo estimate is the most this ride can cost (pooling only discounts it), so a balance that
      // covers it always covers the Final Fare at drop-off.
      const passenger = await tx.user.findUniqueOrThrow({ where: { id: passengerId } });
      if (passenger.teslapayBalancePaisa < estimate.solo.totalPaisa) {
        throw unprocessable('Not enough TeslaPay balance for this ride; choose cash instead');
      }
    }
    const ride = await tx.rideRequest
      .create({ data: { passengerId, ...input, distanceM: estimate.distanceM, estimatedSoloPaisa: estimate.solo.totalPaisa } })
      .catch((err) => {
        // ride_requests_one_active_per_passenger: the database, not app code, stops double-booking.
        throw isUniqueViolation(err) ? conflict('You already have an active ride') : err;
      });
    await recordEvent(tx, {
      type: 'REQUESTED',
      rideRequestId: ride.id,
      actorUserId: passengerId,
      toStatus: 'REQUESTED',
      detail: { distanceM: estimate.distanceM, estimatedSoloPaisa: estimate.solo.totalPaisa, estimatedPooledPaisa: estimate.pooled.totalPaisa },
    });
    return ride.id;
  });
  return getPassengerRide(passengerId, id);
}

export async function listPassengerRides(passengerId: string) {
  const rides = await prisma.rideRequest.findMany({ where: { passengerId }, include: rideInclude, orderBy: { createdAt: 'desc' }, take: 50 });
  return rides.map((r) => passengerRideView(r, null));
}

export async function getPassengerRide(passengerId: string, id: string) {
  const ride = await prisma.rideRequest.findFirst({ where: { id, passengerId }, include: rideInclude });
  if (!ride) throw notFound('Ride not found');
  const coRiders = ride.tripId
    ? await prisma.rideRequest.count({
        where: { tripId: ride.tripId, id: { not: id }, status: { in: ['MATCHED', 'IN_PROGRESS', 'COMPLETED'] } },
      })
    : null;
  return passengerRideView(ride, coRiders);
}

export async function cancelRideRequest(passengerId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const ride = await tx.rideRequest.findFirst({ where: { id, passengerId } });
    if (!ride) throw notFound('Ride not found');
    if (!canMoveRequest(ride.status, 'CANCELLED')) throw conflict(`This ride is ${ride.status} and can no longer be cancelled`);

    if (ride.tripId) {
      // Only while the Tesla is still on its way; this UPDATE also serialises with Accept and Arrive on the same Trip.
      const released = await tx.trip.updateMany({
        where: { id: ride.tripId, status: 'ACCEPTED' },
        data: { seatsTaken: { decrement: ride.seats } },
      });
      if (released.count === 0) throw conflict('Your Tesla has already arrived or the trip changed; refresh to see the latest');
    }

    const cancelled = await tx.rideRequest.updateMany({ where: { id, status: ride.status }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    if (cancelled.count === 0) throw conflict('This ride changed while you were cancelling; refresh and try again');
    await recordEvent(tx, {
      type: 'CANCELLED',
      tripId: ride.tripId,
      rideRequestId: id,
      actorUserId: passengerId,
      fromStatus: ride.status,
      toStatus: 'CANCELLED',
      detail: { seatsFreed: ride.seats },
    });

    if (ride.tripId) {
      const trip = await tx.trip.findUniqueOrThrow({ where: { id: ride.tripId } });
      if (trip.seatsTaken === 0) {
        await tx.trip.update({ where: { id: trip.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
        await recordEvent(tx, {
          type: 'CANCELLED',
          tripId: trip.id,
          actorUserId: passengerId,
          fromStatus: 'ACCEPTED',
          toStatus: 'CANCELLED',
          detail: { reason: 'last passenger cancelled' },
        });
      }
    }
  });
  return getPassengerRide(passengerId, id);
}
