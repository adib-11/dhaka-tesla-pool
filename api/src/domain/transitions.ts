import type { RequestStatus, TripStatus } from '@prisma/client';

const TRIP: Record<TripStatus, TripStatus[]> = {
  ACCEPTED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

const REQUEST: Record<RequestStatus, RequestStatus[]> = {
  REQUESTED: ['MATCHED', 'CANCELLED'],
  MATCHED: ['IN_PROGRESS', 'CANCELLED', 'REQUESTED'], // REQUESTED = Requeue after the Driver cancels
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const canMoveTrip = (from: TripStatus, to: TripStatus) => TRIP[from].includes(to);
export const canMoveRequest = (from: RequestStatus, to: RequestStatus) => REQUEST[from].includes(to);
