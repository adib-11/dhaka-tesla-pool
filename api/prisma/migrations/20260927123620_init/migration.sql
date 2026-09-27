-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PASSENGER', 'DRIVER');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('ACCEPTED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('REQUESTED', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TESLAPAY');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('REQUESTED', 'ACCEPTED', 'JOINED_POOL', 'DRIVER_ARRIVED', 'STARTED', 'FARE_LOCKED', 'DROPPED_OFF', 'PAID', 'CANCELLED', 'REQUEUED', 'TRIP_COMPLETED');

-- CreateEnum
CREATE TYPE "TeslapayTxType" AS ENUM ('TOP_UP', 'RIDE_CHARGE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "teslapay_balance_paisa" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teslas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driver_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "current_zone_id" INTEGER,

    CONSTRAINT "teslas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tesla_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "pickup_zone_id" INTEGER NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'ACCEPTED',
    "capacity" INTEGER NOT NULL,
    "seats_taken" INTEGER NOT NULL DEFAULT 0,
    "is_solo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrived_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "passenger_id" UUID NOT NULL,
    "trip_id" UUID,
    "pickup_zone_id" INTEGER NOT NULL,
    "dropoff_zone_id" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL,
    "allow_sharing" BOOLEAN NOT NULL DEFAULT true,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "RequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "distance_m" INTEGER NOT NULL,
    "estimated_solo_paisa" INTEGER NOT NULL,
    "base_fare_paisa" INTEGER,
    "distance_charge_paisa" INTEGER,
    "pool_discount_paisa" INTEGER,
    "final_fare_paisa" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matched_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "paid_at" TIMESTAMPTZ,

    CONSTRAINT "ride_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_events" (
    "id" SERIAL NOT NULL,
    "type" "EventType" NOT NULL,
    "trip_id" UUID,
    "ride_request_id" UUID,
    "actor_user_id" UUID,
    "from_status" TEXT,
    "to_status" TEXT,
    "detail" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teslapay_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "ride_request_id" UUID,
    "type" "TeslapayTxType" NOT NULL,
    "amount_paisa" INTEGER NOT NULL,
    "balance_after_paisa" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teslapay_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "zones_name_key" ON "zones"("name");

-- CreateIndex
CREATE UNIQUE INDEX "teslas_driver_id_key" ON "teslas"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "teslas_plate_key" ON "teslas"("plate");

-- CreateIndex
CREATE INDEX "trips_driver_id_created_at_idx" ON "trips"("driver_id", "created_at");

-- CreateIndex
CREATE INDEX "ride_requests_passenger_id_created_at_idx" ON "ride_requests"("passenger_id", "created_at");

-- CreateIndex
CREATE INDEX "ride_requests_status_pickup_zone_id_idx" ON "ride_requests"("status", "pickup_zone_id");

-- CreateIndex
CREATE INDEX "ride_requests_trip_id_idx" ON "ride_requests"("trip_id");

-- CreateIndex
CREATE INDEX "ride_events_ride_request_id_id_idx" ON "ride_events"("ride_request_id", "id");

-- CreateIndex
CREATE INDEX "ride_events_trip_id_id_idx" ON "ride_events"("trip_id", "id");

-- CreateIndex
CREATE INDEX "teslapay_transactions_user_id_created_at_idx" ON "teslapay_transactions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "teslapay_transactions_ride_request_id_type_key" ON "teslapay_transactions"("ride_request_id", "type");

-- AddForeignKey
ALTER TABLE "teslas" ADD CONSTRAINT "teslas_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teslas" ADD CONSTRAINT "teslas_current_zone_id_fkey" FOREIGN KEY ("current_zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_tesla_id_fkey" FOREIGN KEY ("tesla_id") REFERENCES "teslas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_pickup_zone_id_fkey" FOREIGN KEY ("pickup_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_pickup_zone_id_fkey" FOREIGN KEY ("pickup_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_dropoff_zone_id_fkey" FOREIGN KEY ("dropoff_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teslapay_transactions" ADD CONSTRAINT "teslapay_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teslapay_transactions" ADD CONSTRAINT "teslapay_transactions_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integrity rules the database enforces (Prisma schema cannot declare these).
ALTER TABLE teslas        ADD CONSTRAINT teslas_capacity_range        CHECK (capacity BETWEEN 1 AND 6);
ALTER TABLE trips         ADD CONSTRAINT trips_seats_within_capacity  CHECK (seats_taken >= 0 AND seats_taken <= capacity);
ALTER TABLE ride_requests ADD CONSTRAINT ride_requests_seats_range    CHECK (seats BETWEEN 1 AND 3);
ALTER TABLE ride_requests ADD CONSTRAINT ride_requests_distinct_zones CHECK (pickup_zone_id <> dropoff_zone_id);
ALTER TABLE users         ADD CONSTRAINT users_teslapay_non_negative  CHECK (teslapay_balance_paisa >= 0);

-- One active Trip per Driver, one active Ride Request per Passenger.
CREATE UNIQUE INDEX trips_one_active_per_driver
  ON trips (driver_id) WHERE status IN ('ACCEPTED', 'DRIVER_ARRIVED', 'STARTED');
CREATE UNIQUE INDEX ride_requests_one_active_per_passenger
  ON ride_requests (passenger_id) WHERE status IN ('REQUESTED', 'MATCHED', 'IN_PROGRESS');
