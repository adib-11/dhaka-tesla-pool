import type { Prisma, RideRequest } from '@prisma/client';
import { recordEvent } from './events';

/** Called inside the drop-off transaction. Cash only for now; TeslaPay arrives in feature/teslapay. */
export async function settlePayment(tx: Prisma.TransactionClient, ride: RideRequest, driverId: string) {
  await recordEvent(tx, {
    type: 'PAID',
    tripId: ride.tripId,
    rideRequestId: ride.id,
    actorUserId: driverId,
    detail: { method: 'CASH', amountPaisa: ride.finalFarePaisa!, fellBackToCash: false },
  });
}
