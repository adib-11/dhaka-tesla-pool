import type { EventType, Prisma } from '@prisma/client';

export type NewEvent = {
  type: EventType;
  tripId?: string | null;
  rideRequestId?: string | null;
  actorUserId?: string | null;
  fromStatus?: string;
  toStatus?: string;
  detail?: Prisma.InputJsonValue;
};

/** Always called inside the same transaction as the state change it describes. */
export function recordEvent(tx: Prisma.TransactionClient, event: NewEvent) {
  return tx.rideEvent.create({ data: event });
}
