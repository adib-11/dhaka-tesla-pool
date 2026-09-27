import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { calculateFare } from '../src/domain/fare';
import { roadDistanceM } from '../src/domain/geo';

export const DEMO_PASSWORD = 'bullet-3-seats';
export const STARTING_BALANCE_PAISA = 100_000; // ৳1,000 of TeslaPay for each seeded Passenger

export const ZONES = [
  { name: 'Banani', lat: 23.794, lng: 90.4043 },
  { name: 'Gulshan 1', lat: 23.7808, lng: 90.4167 },
  { name: 'Gulshan 2', lat: 23.7925, lng: 90.415 },
  { name: 'Mohakhali', lat: 23.7781, lng: 90.4057 },
  { name: 'Farmgate', lat: 23.7577, lng: 90.3897 },
  { name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
  { name: 'Mirpur 10', lat: 23.8069, lng: 90.3687 },
  { name: 'Uttara', lat: 23.8759, lng: 90.3795 },
  { name: 'Bashundhara', lat: 23.8193, lng: 90.4526 },
  { name: 'Motijheel', lat: 23.733, lng: 90.4172 },
];

export const CAST = {
  nusrat: { name: 'Nusrat', email: 'nusrat@teslapool.dev' },
  rafiq: { name: 'Rafiq', email: 'rafiq@teslapool.dev' },
  shirin: { name: 'Shirin', email: 'shirin@teslapool.dev' },
  jashim: { name: 'Jashim', email: 'jashim@teslapool.dev' },
  kamal: { name: 'Kamal', email: 'kamal@teslapool.dev' },
} as const;

type Db = Prisma.TransactionClient;
let passwordHash: string | undefined;

async function zoneIds(db: Db) {
  return Object.fromEntries((await db.zone.findMany()).map((z) => [z.name, z.id])) as Record<string, number>;
}

/** Zones, the cast, and two Teslas. Used by the seed script and before every integration test. */
export async function seedBase(db: Db) {
  passwordHash ??= await bcrypt.hash(DEMO_PASSWORD, 10);
  await db.zone.createMany({ data: ZONES });
  const zone = await zoneIds(db);

  for (const passenger of [CAST.nusrat, CAST.rafiq, CAST.shirin]) {
    const user = await db.user.create({
      data: { ...passenger, role: 'PASSENGER', passwordHash, teslapayBalancePaisa: STARTING_BALANCE_PAISA },
    });
    await db.teslapayTransaction.create({
      data: { userId: user.id, type: 'TOP_UP', amountPaisa: STARTING_BALANCE_PAISA, balanceAfterPaisa: STARTING_BALANCE_PAISA },
    });
  }

  await db.user.create({
    data: {
      ...CAST.jashim,
      role: 'DRIVER',
      passwordHash,
      tesla: { create: { name: 'Bullet', plate: 'DHAKA-METRO-TA-11-3141', capacity: 3, isOnline: true, currentZoneId: zone.Banani } },
    },
  });
  await db.user.create({
    data: {
      ...CAST.kamal,
      role: 'DRIVER',
      passwordHash,
      tesla: { create: { name: 'Toofan', plate: 'DHAKA-METRO-TA-12-2718', capacity: 2, isOnline: false, currentZoneId: zone['Gulshan 1'] } },
    },
  });
}

/** Yesterday's 8:41 AM pooled ride, so history and timeline pages are not empty on first load. Shirin keeps an empty history. */
export async function seedHistory(db: Db) {
  const zone = await zoneIds(db);
  const byEmail = (email: string) => db.user.findUniqueOrThrow({ where: { email } });
  const [nusrat, rafiq, jashim] = await Promise.all([byEmail(CAST.nusrat.email), byEmail(CAST.rafiq.email), byEmail(CAST.jashim.email)]);
  const bullet = await db.tesla.findUniqueOrThrow({ where: { driverId: jashim.id } });

  const yesterdayInDhaka = new Date(Date.now() - 24 * 3600_000 + 6 * 3600_000).toISOString().slice(0, 10);
  const at = (hhmm: string) => new Date(`${yesterdayInDhaka}T${hhmm}:00+06:00`);
  const point = (name: string) => ZONES.find((z) => z.name === name)!;

  const trip = await db.trip.create({
    data: {
      teslaId: bullet.id, driverId: jashim.id, pickupZoneId: zone.Banani, status: 'COMPLETED', capacity: 3, seatsTaken: 2,
      createdAt: at('08:44'), arrivedAt: at('08:49'), startedAt: at('08:50'), completedAt: at('09:08'),
    },
  });

  const passengers = [
    { user: nusrat, to: 'Mohakhali', requested: '08:41', droppedOff: '09:01', paymentMethod: 'TESLAPAY' as const },
    { user: rafiq, to: 'Gulshan 1', requested: '08:43', droppedOff: '09:08', paymentMethod: 'CASH' as const },
  ];
  const requests = [];
  for (const p of passengers) {
    const distanceM = roadDistanceM(point('Banani'), point(p.to));
    const fare = calculateFare({ distanceM, seats: 1, pooled: true });
    const request = await db.rideRequest.create({
      data: {
        passengerId: p.user.id, tripId: trip.id, pickupZoneId: zone.Banani, dropoffZoneId: zone[p.to], seats: 1,
        paymentMethod: p.paymentMethod, status: 'COMPLETED', distanceM,
        estimatedSoloPaisa: calculateFare({ distanceM, seats: 1, pooled: false }).totalPaisa,
        baseFarePaisa: fare.basePaisa, distanceChargePaisa: fare.distanceChargePaisa, poolDiscountPaisa: fare.poolDiscountPaisa, finalFarePaisa: fare.totalPaisa,
        createdAt: at(p.requested), matchedAt: at('08:44'), startedAt: at('08:50'), completedAt: at(p.droppedOff), paidAt: at(p.droppedOff),
      },
    });
    requests.push({ ...p, request, fare });
  }
  const [nusratRequest, rafiqRequest] = requests;

  const balanceAfter = STARTING_BALANCE_PAISA - nusratRequest.fare.totalPaisa;
  await db.user.update({ where: { id: nusrat.id }, data: { teslapayBalancePaisa: balanceAfter } });
  await db.teslapayTransaction.create({
    data: { userId: nusrat.id, rideRequestId: nusratRequest.request.id, type: 'RIDE_CHARGE', amountPaisa: -nusratRequest.fare.totalPaisa, balanceAfterPaisa: balanceAfter, createdAt: at('09:01') },
  });

  // Inserted in chronological order: ride_events.id is the timeline order.
  await db.rideEvent.createMany({
    data: [
      { type: 'REQUESTED', rideRequestId: nusratRequest.request.id, actorUserId: nusrat.id, toStatus: 'REQUESTED', createdAt: at('08:41') },
      { type: 'REQUESTED', rideRequestId: rafiqRequest.request.id, actorUserId: rafiq.id, toStatus: 'REQUESTED', createdAt: at('08:43') },
      { type: 'ACCEPTED', tripId: trip.id, rideRequestId: nusratRequest.request.id, actorUserId: jashim.id, fromStatus: 'REQUESTED', toStatus: 'MATCHED', detail: { seatsTaken: 1, capacity: 3 }, createdAt: at('08:44') },
      { type: 'JOINED_POOL', tripId: trip.id, rideRequestId: rafiqRequest.request.id, actorUserId: jashim.id, fromStatus: 'REQUESTED', toStatus: 'MATCHED', detail: { seatsTaken: 2, capacity: 3 }, createdAt: at('08:44') },
      { type: 'DRIVER_ARRIVED', tripId: trip.id, actorUserId: jashim.id, fromStatus: 'ACCEPTED', toStatus: 'DRIVER_ARRIVED', createdAt: at('08:49') },
      { type: 'STARTED', tripId: trip.id, actorUserId: jashim.id, fromStatus: 'DRIVER_ARRIVED', toStatus: 'STARTED', createdAt: at('08:50') },
      { type: 'FARE_LOCKED', tripId: trip.id, rideRequestId: nusratRequest.request.id, actorUserId: jashim.id, fromStatus: 'MATCHED', toStatus: 'IN_PROGRESS', detail: { ...nusratRequest.fare, pooled: true, passengersOnTrip: 2 }, createdAt: at('08:50') },
      { type: 'FARE_LOCKED', tripId: trip.id, rideRequestId: rafiqRequest.request.id, actorUserId: jashim.id, fromStatus: 'MATCHED', toStatus: 'IN_PROGRESS', detail: { ...rafiqRequest.fare, pooled: true, passengersOnTrip: 2 }, createdAt: at('08:50') },
      { type: 'DROPPED_OFF', tripId: trip.id, rideRequestId: nusratRequest.request.id, actorUserId: jashim.id, fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', createdAt: at('09:01') },
      { type: 'PAID', tripId: trip.id, rideRequestId: nusratRequest.request.id, actorUserId: jashim.id, detail: { method: 'TESLAPAY', amountPaisa: nusratRequest.fare.totalPaisa, fellBackToCash: false }, createdAt: at('09:01') },
      { type: 'DROPPED_OFF', tripId: trip.id, rideRequestId: rafiqRequest.request.id, actorUserId: jashim.id, fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', createdAt: at('09:08') },
      { type: 'PAID', tripId: trip.id, rideRequestId: rafiqRequest.request.id, actorUserId: jashim.id, detail: { method: 'CASH', amountPaisa: rafiqRequest.fare.totalPaisa, fellBackToCash: false }, createdAt: at('09:08') },
      { type: 'TRIP_COMPLETED', tripId: trip.id, actorUserId: jashim.id, fromStatus: 'STARTED', toStatus: 'COMPLETED', createdAt: at('09:08') },
    ],
  });
}
