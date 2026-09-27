import type { PaymentMethod, Prisma, RideRequest } from '@prisma/client';
import { prisma } from '../db';
import { recordEvent } from './events';
import { teslapayLedgerEntryView, teslapayLedgerInclude } from './views';

/** Called inside the drop-off transaction, so the charge, ledger row and event commit together or not at all. */
export async function settlePayment(tx: Prisma.TransactionClient, ride: RideRequest, driverId: string) {
  const amountPaisa = ride.finalFarePaisa!;
  let method: PaymentMethod = ride.paymentMethod;

  if (method === 'TESLAPAY') {
    const charged = await tx.user.updateMany({
      where: { id: ride.passengerId, teslapayBalancePaisa: { gte: amountPaisa } },
      data: { teslapayBalancePaisa: { decrement: amountPaisa } },
    });
    if (charged.count === 1) {
      const { teslapayBalancePaisa } = await tx.user.findUniqueOrThrow({ where: { id: ride.passengerId } });
      await tx.teslapayTransaction.create({
        data: { userId: ride.passengerId, rideRequestId: ride.id, type: 'RIDE_CHARGE', amountPaisa: -amountPaisa, balanceAfterPaisa: teslapayBalancePaisa },
      });
    } else {
      // The balance covered the solo estimate at request time (which is >= the Final Fare), and a Passenger
      // has one active ride, so this only happens if the balance was changed out of band. Collect cash.
      method = 'CASH';
      await tx.rideRequest.update({ where: { id: ride.id }, data: { paymentMethod: 'CASH' } });
    }
  }

  await recordEvent(tx, {
    type: 'PAID',
    tripId: ride.tripId,
    rideRequestId: ride.id,
    actorUserId: driverId,
    detail: { method, amountPaisa, fellBackToCash: method !== ride.paymentMethod },
  });
}

/**
 * A Passenger's TeslaPay balance and the ledger rows it is the sum of. Every row is returned (the
 * balance is exactly their sum), and both reads share one snapshot so a charge cannot land between them.
 */
export async function getTeslapayLedger(userId: string) {
  const [user, rows] = await prisma.$transaction(
    [
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.teslapayTransaction.findMany({ where: { userId }, include: teslapayLedgerInclude, orderBy: { createdAt: 'desc' } }),
    ],
    { isolationLevel: 'RepeatableRead' },
  );
  return { balancePaisa: user.teslapayBalancePaisa, entries: rows.map(teslapayLedgerEntryView) };
}
