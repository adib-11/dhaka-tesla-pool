import type { TripStatus } from '@prisma/client';
import { haversineM, type Point } from './geo';

/** Straight-line limit between any two destinations on one Trip. */
export const MAX_DESTINATION_SPREAD_M = 3000;

export type TripSnapshot = {
  status: TripStatus;
  pickupZoneId: number;
  capacity: number;
  seatsTaken: number;
  isSolo: boolean;
  destinations: Point[];
};

export type RequestSnapshot = { pickupZoneId: number; seats: number; allowSharing: boolean; dropoff: Point };

export function destinationsCompatible(existing: Point[], candidate: Point) {
  return existing.every((d) => haversineM(d, candidate) <= MAX_DESTINATION_SPREAD_M);
}

/** The Compatible rule from CONTEXT.md. An idle Tesla is a Trip with no seats taken. */
export function isCompatible(trip: TripSnapshot, request: RequestSnapshot) {
  if (trip.status !== 'ACCEPTED') return false;
  if (request.pickupZoneId !== trip.pickupZoneId) return false;
  if (request.seats > trip.capacity - trip.seatsTaken) return false;
  if (trip.seatsTaken > 0 && (trip.isSolo || !request.allowSharing)) return false;
  return destinationsCompatible(trip.destinations, request.dropoff);
}
