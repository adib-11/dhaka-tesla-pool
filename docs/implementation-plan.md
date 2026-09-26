# Dhaka Tesla Pool Implementation Plan

> **For agentic workers:** execute task by task, in order. Each task lives on its own branch and ends with a merge into `master`. Steps use checkbox (`- [ ]`) syntax for tracking. Read `CONTEXT.md` (glossary) and `docs/adr/` before starting; use the glossary's words in code, UI copy, tests and commits.

**Goal:** A ride-pooling MVP where Nusrat, Rafiq and Shirin request rides, Jashim accepts them into Bullet (3 seats) without ever overbooking, each Passenger sees only their own fare and status, and every step is kept as a Ride Event.

**Architecture:** Next.js (App Router) web app proxies `/api/*` to an Express 5 REST API through a rewrite, so the session cookie is first-party. The API keeps business rules in `src/domain` (pure functions) and `src/services` (transactions), and talks to Postgres through Prisma. Exactly one raw SQL statement claims seats atomically (ADR 0001). Status updates reach the browser by polling every 3 s.

**Tech Stack:** Node 22, TypeScript, Express 5, Prisma 6, PostgreSQL 16, zod, jsonwebtoken, bcryptjs, pino-http, helmet, express-rate-limit, Vitest, supertest; Next.js (App Router), Tailwind, shadcn/ui, TanStack Query; Docker Compose; Neon + Render + Vercel (free tiers).

## Global Constraints

- Cast is fixed everywhere (seed, tests, README, video): Passengers **Nusrat**, **Rafiq**, **Shirin**; Drivers **Jashim** with **Bullet** (3 seats) and **Kamal** with **Toofan** (2 seats). Signup tests use **Nabila** (Nusrat's sister). Never `user1`/`driver1`.
- Money is always integer **paisa** (100 paisa = ৳1). No floats, no `Decimal` for money.
- Fare: `distanceM = round(haversine × 1.3 / 100) × 100`; `fare = (3000 + distanceM × 2) × seats` paisa; Pool Discount = 25 % when a Trip starts with ≥ 2 active Ride Requests. Nusrat solo ৳76 / pooled ৳57; Rafiq solo ৳80 / pooled ৳60.
- Compatible = same pickup Zone, Trip still `ACCEPTED`, destination ≤ 3 km (straight line) from every destination on the Trip, fits free seats, no Solo Request involved.
- Seats per Ride Request: 1–3. Tesla capacity: 1–6.
- Commit messages: `<type>(<scope>): <short description>`, types `feat|fix|refactor|test|docs|chore|build`. One commit = one logical change. No "update/fix/final/wip".
- Branches: `master`, `feature/*` (one per task below), `pre-release`, `release/v1.0.0`. Merge features with `git merge --no-ff`. Never commit feature work straight to `master`.
- Never commit `.env`, secrets, or the PRD file.
- No Redis, queues, WebSockets, microservices or map APIs.
- Prisma is pinned to **6.x** (7.x changes the generator and requires driver adapters).
- Other-user resources return **404**, wrong role returns **403**, no session returns **401**, invalid transition or lost race returns **409**, bad input returns **422**.

## File Structure

```
.
├── CONTEXT.md                     glossary (exists)
├── README.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── docker/postgres-init/01-test-db.sql
├── docs/
│   ├── adr/0001-atomic-seat-claim.md   (exists)
│   └── implementation-plan.md          (this file)
├── api/
│   ├── Dockerfile
│   ├── package.json  tsconfig.json  vitest.config.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/<timestamp>_init/migration.sql
│   │   ├── seed-data.ts            cast, zones, seedBase(), seedHistory()
│   │   └── seed.ts                 idempotent runner used by Docker/Render
│   ├── scripts/rush-hour.ts        optional demo replay (cut first)
│   ├── src/
│   │   ├── server.ts               listen()
│   │   ├── app.ts                  buildApp(): middleware + routers
│   │   ├── config.ts               env parsing
│   │   ├── db.ts                   Prisma client
│   │   ├── http/errors.ts          AppError, helpers, errorHandler, idParam
│   │   ├── http/auth.ts            session cookie, requireAuth, requireRole
│   │   ├── domain/geo.ts           haversine + road distance
│   │   ├── domain/fare.ts          calculateFare (pure)
│   │   ├── domain/compatibility.ts isCompatible, destinationsCompatible (pure)
│   │   ├── domain/transitions.ts   canMoveTrip, canMoveRequest (pure)
│   │   ├── services/events.ts      recordEvent(tx, …)
│   │   ├── services/views.ts       response shapes
│   │   ├── services/passenger.ts   estimate, create, list, get, cancel
│   │   ├── services/driver.ts      status, compatible list, accept, lifecycle
│   │   ├── services/payments.ts    settlePayment (cash / TeslaPay)
│   │   └── routes/{auth,catalog,passenger,driver,trips}.ts
│   └── test/
│       ├── test-db-url.ts  global-setup.ts  setup.ts  helpers.ts
│       └── *.test.ts
└── web/
    ├── Dockerfile  next.config.ts
    ├── lib/{api,types,session,demo}.ts
    ├── components/  (Header, RequireRole, PageMessage, StatusBadge, ZoneSelect,
    │                 FareReceipt, RideRequestForm, ActiveRideCard, DriverStatusCard,
    │                 CompatibleRequests, CurrentTripPanel, TripActions, Timeline)
    └── app/
        ├── layout.tsx  providers.tsx  page.tsx
        ├── login/page.tsx  signup/page.tsx
        ├── ride/page.tsx  rides/page.tsx  rides/[id]/page.tsx
        └── driver/page.tsx  driver/trips/page.tsx  driver/trips/[id]/page.tsx
```

## Time Budget and Cut Order

| When | Tasks |
|---|---|
| Day 1 morning | 0, 1, 2 |
| Day 1 afternoon | 3, 4, 5, 6 |
| Day 2 morning | 7, 8, 9 |
| Day 2 afternoon | 10 (deploy, README, diagrams, video, release) |

If behind, cut in this order: `scripts/rush-hour.ts` → viral-scale detail (keep bullets) → Task 8 TeslaPay (fall back to cash, list under limitations) → per-passenger drop-off (complete the whole Trip at once). **Never cut** tests, Docker, the git process, or the README.

---

### Task 0: Repository bootstrap (on `master`)

**Files:**
- Create: `.gitignore`, `README.md` (stub)
- Existing: `CONTEXT.md`, `docs/adr/0001-atomic-seat-claim.md`, `docs/implementation-plan.md`

- [ ] **Step 1: Init git**

```bash
cd /Users/adib/Desktop/Tesla
git init -b master
```

- [ ] **Step 2: Write `.gitignore`**

```gitignore
node_modules/
dist/
.next/
.env
.env.local
*.log
.DS_Store
coverage/
# Assignment brief stays private
Dhaka_Tesla_Pool_PRD_Internship.md
```

- [ ] **Step 3: Write `README.md` stub**

```markdown
# Dhaka Tesla Pool

Share a seat. Split the fare. Survive Dhaka traffic.

Work in progress. See `docs/implementation-plan.md` for the plan and `CONTEXT.md` for the domain language.
```

- [ ] **Step 4: Commit and publish**

```bash
git add .gitignore README.md CONTEXT.md docs
git commit -m "docs(repo): add domain glossary, seat-claim ADR and implementation plan"
gh repo create dhaka-tesla-pool --public --source . --push
```

Expected: repo visible on GitHub with one commit on `master`.

---

### Task 1: Docker, database schema and seed (`feature/docker-db-schema`)

**Files:**
- Create: `api/package.json`, `api/tsconfig.json`, `api/vitest.config.ts`
- Create: `api/src/{config,db,app,server}.ts`, `api/src/http/errors.ts`
- Create: `api/prisma/schema.prisma`, `api/prisma/migrations/*_init/migration.sql`, `api/prisma/seed-data.ts`, `api/prisma/seed.ts`
- Create: `api/test/{test-db-url,global-setup,setup,helpers}.ts`, `api/test/health.test.ts`
- Create: `api/Dockerfile`, `docker-compose.yml`, `docker/postgres-init/01-test-db.sql`, `.env.example`

**Interfaces:**
- Produces: `prisma` (`src/db.ts`); `buildApp()` and `logger` (`src/app.ts`); `config` (`src/config.ts`); `AppError`, `notFound`, `conflict`, `unprocessable`, `unauthorized`, `forbidden`, `isUniqueViolation`, `idParam`, `errorHandler` (`src/http/errors.ts`); `ZONES`, `CAST`, `DEMO_PASSWORD`, `STARTING_BALANCE_PAISA`, `seedBase(db)`, `seedHistory(db)` (`prisma/seed-data.ts`); test helpers `app`, `resetDb()`, `zoneId(name)`.

- [ ] **Step 1: Branch and install**

```bash
git checkout -b feature/docker-db-schema master
mkdir -p api && cd api
npm init -y
npm i express@5 @prisma/client@6 prisma@6 zod pino pino-http helmet cookie-parser bcryptjs
npm i -D typescript tsx vitest supertest @types/express @types/node @types/supertest @types/cookie-parser
```

`prisma` is a runtime dependency on purpose: the container runs `prisma migrate deploy` on start.

- [ ] **Step 2: Write `api/package.json` scripts and seed hook** (keep the generated dependency lists)

```json
{
  "name": "dhaka-tesla-pool-api",
  "private": true,
  "scripts": {
    "dev": "tsx watch --env-file=../.env src/server.ts",
    "build": "tsc",
    "start": "node dist/src/server.js",
    "test": "vitest run",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx --env-file=../.env prisma/seed.ts",
    "demo:rush-hour": "tsx scripts/rush-hour.ts"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" }
}
```

- [ ] **Step 3: Write `api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src", "prisma", "scripts"]
}
```

- [ ] **Step 4: Write `api/src/config.ts`**

```ts
import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  // true behind HTTPS (Render/Vercel); false for http://localhost so Safari keeps the cookie
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

export const config = Env.parse(process.env);
```

- [ ] **Step 5: Write `api/src/db.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 6: Write `api/src/http/errors.ts`**

```ts
import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (message = 'Not found') => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);
export const unprocessable = (message: string) => new AppError(422, message);
export const unauthorized = (message = 'Please sign in') => new AppError(401, message);
export const forbidden = (message = 'Not allowed for your role') => new AppError(403, message);

export function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A malformed id can't match anything, so it is a 404, not a 500 from Postgres. */
export function idParam(value: string, message = 'Not found') {
  if (!UUID.test(value)) throw notFound(message);
  return value;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Invalid input', issues: err.issues });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON' });
    return;
  }
  req.log.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'Something went wrong' });
};
```

- [ ] **Step 7: Write `api/src/app.ts`**

```ts
import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { config } from './config';
import { prisma } from './db';
import { errorHandler } from './http/errors';

export const logger = pino({ enabled: config.NODE_ENV !== 'test' });

export function buildApp() {
  const app = express();
  // ponytail: trusts one proxy hop (Render). Vercel -> Render adds a second hop, so rate-limit
  // keys may group users behind the same Vercel edge; set the real hop count once measured.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
    }),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });

  // Routers are mounted here by later tasks.

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 8: Write `api/src/server.ts`**

```ts
import { buildApp, logger } from './app';
import { config } from './config';

buildApp().listen(config.PORT, () => logger.info(`API listening on :${config.PORT}`));
```

- [ ] **Step 9: Write `api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  PASSENGER
  DRIVER
}

enum TripStatus {
  ACCEPTED
  DRIVER_ARRIVED
  STARTED
  COMPLETED
  CANCELLED
}

enum RequestStatus {
  REQUESTED
  MATCHED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum PaymentMethod {
  CASH
  TESLAPAY
}

enum EventType {
  REQUESTED
  ACCEPTED
  JOINED_POOL
  DRIVER_ARRIVED
  STARTED
  FARE_LOCKED
  DROPPED_OFF
  PAID
  CANCELLED
  REQUEUED
  TRIP_COMPLETED
}

enum TeslapayTxType {
  TOP_UP
  RIDE_CHARGE
}

model User {
  id                   String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  role                 Role
  name                 String
  email                String   @unique
  passwordHash         String   @map("password_hash")
  teslapayBalancePaisa Int      @default(0) @map("teslapay_balance_paisa")
  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamptz

  tesla                Tesla?
  rideRequests         RideRequest[]
  trips                Trip[]
  teslapayTransactions TeslapayTransaction[]
  events               RideEvent[]

  @@map("users")
}

model Zone {
  id   Int    @id @default(autoincrement())
  name String @unique
  lat  Float
  lng  Float

  teslas   Tesla[]
  trips    Trip[]
  pickups  RideRequest[] @relation("pickup")
  dropoffs RideRequest[] @relation("dropoff")

  @@map("zones")
}

model Tesla {
  id            String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  driverId      String  @unique @map("driver_id") @db.Uuid
  name          String
  plate         String  @unique
  capacity      Int
  isOnline      Boolean @default(false) @map("is_online")
  currentZoneId Int?    @map("current_zone_id")

  driver      User   @relation(fields: [driverId], references: [id])
  currentZone Zone?  @relation(fields: [currentZoneId], references: [id])
  trips       Trip[]

  @@map("teslas")
}

model Trip {
  id           String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  teslaId      String     @map("tesla_id") @db.Uuid
  driverId     String     @map("driver_id") @db.Uuid
  pickupZoneId Int        @map("pickup_zone_id")
  status       TripStatus @default(ACCEPTED)
  /// Snapshot of the Tesla's capacity: a CHECK constraint cannot read another table (ADR 0001).
  capacity     Int
  seatsTaken   Int        @default(0) @map("seats_taken")
  isSolo       Boolean    @default(false) @map("is_solo")
  createdAt    DateTime   @default(now()) @map("created_at") @db.Timestamptz
  arrivedAt    DateTime?  @map("arrived_at") @db.Timestamptz
  startedAt    DateTime?  @map("started_at") @db.Timestamptz
  completedAt  DateTime?  @map("completed_at") @db.Timestamptz
  cancelledAt  DateTime?  @map("cancelled_at") @db.Timestamptz

  tesla      Tesla         @relation(fields: [teslaId], references: [id])
  driver     User          @relation(fields: [driverId], references: [id])
  pickupZone Zone          @relation(fields: [pickupZoneId], references: [id])
  requests   RideRequest[]
  events     RideEvent[]

  @@index([driverId, createdAt])
  @@map("trips")
}

model RideRequest {
  id                  String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  passengerId         String        @map("passenger_id") @db.Uuid
  tripId              String?       @map("trip_id") @db.Uuid
  pickupZoneId        Int           @map("pickup_zone_id")
  dropoffZoneId       Int           @map("dropoff_zone_id")
  seats               Int
  allowSharing        Boolean       @default(true) @map("allow_sharing")
  paymentMethod       PaymentMethod @default(CASH) @map("payment_method")
  status              RequestStatus @default(REQUESTED)
  distanceM           Int           @map("distance_m")
  estimatedSoloPaisa  Int           @map("estimated_solo_paisa")
  baseFarePaisa       Int?          @map("base_fare_paisa")
  distanceChargePaisa Int?          @map("distance_charge_paisa")
  poolDiscountPaisa   Int?          @map("pool_discount_paisa")
  finalFarePaisa      Int?          @map("final_fare_paisa")
  createdAt           DateTime      @default(now()) @map("created_at") @db.Timestamptz
  matchedAt           DateTime?     @map("matched_at") @db.Timestamptz
  startedAt           DateTime?     @map("started_at") @db.Timestamptz
  completedAt         DateTime?     @map("completed_at") @db.Timestamptz
  cancelledAt         DateTime?     @map("cancelled_at") @db.Timestamptz
  paidAt              DateTime?     @map("paid_at") @db.Timestamptz

  passenger            User                  @relation(fields: [passengerId], references: [id])
  trip                 Trip?                 @relation(fields: [tripId], references: [id])
  pickupZone           Zone                  @relation("pickup", fields: [pickupZoneId], references: [id])
  dropoffZone          Zone                  @relation("dropoff", fields: [dropoffZoneId], references: [id])
  events               RideEvent[]
  teslapayTransactions TeslapayTransaction[]

  @@index([passengerId, createdAt])
  @@index([status, pickupZoneId])
  @@index([tripId])
  @@map("ride_requests")
}

model RideEvent {
  id            Int       @id @default(autoincrement())
  type          EventType
  tripId        String?   @map("trip_id") @db.Uuid
  rideRequestId String?   @map("ride_request_id") @db.Uuid
  actorUserId   String?   @map("actor_user_id") @db.Uuid
  fromStatus    String?   @map("from_status")
  toStatus      String?   @map("to_status")
  detail        Json?
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz

  trip        Trip?        @relation(fields: [tripId], references: [id])
  rideRequest RideRequest? @relation(fields: [rideRequestId], references: [id])
  actor       User?        @relation(fields: [actorUserId], references: [id])

  @@index([rideRequestId, id])
  @@index([tripId, id])
  @@map("ride_events")
}

model TeslapayTransaction {
  id                String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId            String         @map("user_id") @db.Uuid
  rideRequestId     String?        @map("ride_request_id") @db.Uuid
  type              TeslapayTxType
  amountPaisa       Int            @map("amount_paisa")
  balanceAfterPaisa Int            @map("balance_after_paisa")
  createdAt         DateTime       @default(now()) @map("created_at") @db.Timestamptz

  user        User         @relation(fields: [userId], references: [id])
  rideRequest RideRequest? @relation(fields: [rideRequestId], references: [id])

  @@unique([rideRequestId, type])
  @@index([userId, createdAt])
  @@map("teslapay_transactions")
}
```

- [ ] **Step 10: Write compose, Postgres init script and `.env.example`**

`docker/postgres-init/01-test-db.sql`:

```sql
-- Second database used only by the API test suite.
CREATE DATABASE tesla_pool_test;
```

`.env.example` (repo root; copy to `.env`):

```dotenv
# Postgres used by docker compose and local dev
POSTGRES_USER=tesla
POSTGRES_PASSWORD=tesla
POSTGRES_DB=tesla_pool

# API (local `npm run dev` reads this file; compose overrides DATABASE_URL to reach the db container)
DATABASE_URL=postgresql://tesla:tesla@localhost:5432/tesla_pool
JWT_SECRET=replace-with-at-least-32-random-characters
COOKIE_SECURE=false
PORT=4000
```

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-tesla}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-tesla}
      POSTGRES_DB: ${POSTGRES_DB:-tesla_pool}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/postgres-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-tesla} -d ${POSTGRES_DB:-tesla_pool}"]
      interval: 5s
      retries: 10

  api:
    build: ./api
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-tesla}:${POSTGRES_PASSWORD:-tesla}@db:5432/${POSTGRES_DB:-tesla_pool}
      JWT_SECRET: ${JWT_SECRET:-local-docker-only-secret-not-for-production}
      COOKIE_SECURE: "false"
      PORT: "4000"
    ports:
      - "4000:4000"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      start_period: 30s
      retries: 5

volumes:
  pgdata:
```

Compose works without a `.env` file (defaults above) so `docker compose up` succeeds on a fresh clone.

- [ ] **Step 11: Generate the migration and add the constraints Prisma cannot express**

```bash
cd /Users/adib/Desktop/Tesla
cp .env.example .env
docker compose up -d db
cd api
npx prisma migrate dev --name init --create-only
```

Append to the end of `api/prisma/migrations/<timestamp>_init/migration.sql`:

```sql
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
```

Then apply:

```bash
npx prisma migrate dev
```

Expected: `Your database is now in sync with your schema.`

> Warning for later migrations: Prisma does not know the two partial indexes. If a future `prisma migrate dev` generates `DROP INDEX "trips_one_active_per_driver"` (or the passenger one), delete those lines from the generated SQL before applying.

- [ ] **Step 12: Write `api/prisma/seed-data.ts`**

```ts
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

  const riders = [
    { user: nusrat, to: 'Mohakhali', requested: '08:41', droppedOff: '09:01', paymentMethod: 'TESLAPAY' as const },
    { user: rafiq, to: 'Gulshan 1', requested: '08:43', droppedOff: '09:08', paymentMethod: 'CASH' as const },
  ];
  const rides = [];
  for (const r of riders) {
    const distanceM = roadDistanceM(point('Banani'), point(r.to));
    const fare = calculateFare({ distanceM, seats: 1, pooled: true });
    const ride = await db.rideRequest.create({
      data: {
        passengerId: r.user.id, tripId: trip.id, pickupZoneId: zone.Banani, dropoffZoneId: zone[r.to], seats: 1,
        paymentMethod: r.paymentMethod, status: 'COMPLETED', distanceM,
        estimatedSoloPaisa: calculateFare({ distanceM, seats: 1, pooled: false }).totalPaisa,
        baseFarePaisa: fare.basePaisa, distanceChargePaisa: fare.distanceChargePaisa, poolDiscountPaisa: fare.poolDiscountPaisa, finalFarePaisa: fare.totalPaisa,
        createdAt: at(r.requested), matchedAt: at('08:44'), startedAt: at('08:50'), completedAt: at(r.droppedOff), paidAt: at(r.droppedOff),
      },
    });
    rides.push({ ...r, ride, fare });
  }
  const [n, f] = rides;

  const balanceAfter = STARTING_BALANCE_PAISA - n.fare.totalPaisa;
  await db.user.update({ where: { id: nusrat.id }, data: { teslapayBalancePaisa: balanceAfter } });
  await db.teslapayTransaction.create({
    data: { userId: nusrat.id, rideRequestId: n.ride.id, type: 'RIDE_CHARGE', amountPaisa: -n.fare.totalPaisa, balanceAfterPaisa: balanceAfter, createdAt: at('09:01') },
  });

  // Inserted in chronological order: ride_events.id is the timeline order.
  await db.rideEvent.createMany({
    data: [
      { type: 'REQUESTED', rideRequestId: n.ride.id, actorUserId: nusrat.id, toStatus: 'REQUESTED', createdAt: at('08:41') },
      { type: 'REQUESTED', rideRequestId: f.ride.id, actorUserId: rafiq.id, toStatus: 'REQUESTED', createdAt: at('08:43') },
      { type: 'ACCEPTED', tripId: trip.id, rideRequestId: n.ride.id, actorUserId: jashim.id, fromStatus: 'REQUESTED', toStatus: 'MATCHED', detail: { seatsTaken: 1, capacity: 3 }, createdAt: at('08:44') },
      { type: 'JOINED_POOL', tripId: trip.id, rideRequestId: f.ride.id, actorUserId: jashim.id, fromStatus: 'REQUESTED', toStatus: 'MATCHED', detail: { seatsTaken: 2, capacity: 3 }, createdAt: at('08:44') },
      { type: 'DRIVER_ARRIVED', tripId: trip.id, actorUserId: jashim.id, fromStatus: 'ACCEPTED', toStatus: 'DRIVER_ARRIVED', createdAt: at('08:49') },
      { type: 'STARTED', tripId: trip.id, actorUserId: jashim.id, fromStatus: 'DRIVER_ARRIVED', toStatus: 'STARTED', createdAt: at('08:50') },
      { type: 'FARE_LOCKED', tripId: trip.id, rideRequestId: n.ride.id, actorUserId: jashim.id, fromStatus: 'MATCHED', toStatus: 'IN_PROGRESS', detail: { ...n.fare, pooled: true, passengersOnTrip: 2 }, createdAt: at('08:50') },
      { type: 'FARE_LOCKED', tripId: trip.id, rideRequestId: f.ride.id, actorUserId: jashim.id, fromStatus: 'MATCHED', toStatus: 'IN_PROGRESS', detail: { ...f.fare, pooled: true, passengersOnTrip: 2 }, createdAt: at('08:50') },
      { type: 'DROPPED_OFF', tripId: trip.id, rideRequestId: n.ride.id, actorUserId: jashim.id, fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', createdAt: at('09:01') },
      { type: 'PAID', tripId: trip.id, rideRequestId: n.ride.id, actorUserId: jashim.id, detail: { method: 'TESLAPAY', amountPaisa: n.fare.totalPaisa, fellBackToCash: false }, createdAt: at('09:01') },
      { type: 'DROPPED_OFF', tripId: trip.id, rideRequestId: f.ride.id, actorUserId: jashim.id, fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', createdAt: at('09:08') },
      { type: 'PAID', tripId: trip.id, rideRequestId: f.ride.id, actorUserId: jashim.id, detail: { method: 'CASH', amountPaisa: f.fare.totalPaisa, fellBackToCash: false }, createdAt: at('09:08') },
      { type: 'TRIP_COMPLETED', tripId: trip.id, actorUserId: jashim.id, fromStatus: 'STARTED', toStatus: 'COMPLETED', createdAt: at('09:08') },
    ],
  });
}
```

This file imports `src/domain/fare.ts` and `src/domain/geo.ts`, which Task 3 writes with tests. To keep this branch compiling, write both domain files now exactly as shown in Task 3 Steps 3–4, and add their tests in Task 3.

- [ ] **Step 13: Write `api/prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import { seedBase, seedHistory } from './seed-data';

const prisma = new PrismaClient();

async function main() {
  // Idempotent: the container runs this on every start.
  if (await prisma.user.count()) {
    console.log('Database already seeded, skipping');
    return;
  }
  await prisma.$transaction(
    async (tx) => {
      await seedBase(tx);
      await seedHistory(tx);
    },
    { timeout: 30_000 },
  );
  console.log('Seeded the Banani rush-hour cast');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Run: `npm run db:seed`. Expected: `Seeded the Banani rush-hour cast`. Run again. Expected: `Database already seeded, skipping`.

- [ ] **Step 14: Write the test harness**

`api/test/test-db-url.ts`:

```ts
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://tesla:tesla@localhost:5432/tesla_pool_test';
```

`api/test/global-setup.ts`:

```ts
import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-db-url';

export default function setup() {
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL } });
}
```

`api/test/setup.ts`:

```ts
import { afterAll } from 'vitest';
import { prisma } from '../src/db';

afterAll(() => prisma.$disconnect());
```

`api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/test-db-url';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-only-secret-that-is-at-least-32-characters',
    },
    globalSetup: './test/global-setup.ts',
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false, // integration files share one database
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
```

`api/test/helpers.ts`:

```ts
import request from 'supertest';
import { buildApp } from '../src/app';
import { prisma } from '../src/db';
import { seedBase } from '../prisma/seed-data';

export const app = buildApp();
export type Agent = ReturnType<typeof request.agent>;

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE ride_events, teslapay_transactions, ride_requests, trips, teslas, users, zones RESTART IDENTITY CASCADE',
  );
  await seedBase(prisma);
}

export async function zoneId(name: string) {
  return (await prisma.zone.findUniqueOrThrow({ where: { name } })).id;
}
```

- [ ] **Step 15: Write the failing health test**

`api/test/health.test.ts`:

```ts
import request from 'supertest';
import { describe, it } from 'vitest';
import { app } from './helpers';

describe('GET /health', () => {
  it('reports ok when the database answers', async () => {
    await request(app).get('/health').expect(200, { status: 'ok' });
  });

  it('returns JSON 404 for unknown routes', async () => {
    await request(app).get('/nope').expect(404, { error: 'Route not found' });
  });
});
```

Run: `npm test`. Expected: both PASS (the app already has `/health`). If `ECONNREFUSED`, run `docker compose up -d db` from the repo root. If `database "tesla_pool_test" does not exist`, the volume predates the init script: run `docker compose down -v && docker compose up -d db`.

- [ ] **Step 16: Write `api/Dockerfile`**

```dockerfile
FROM node:22-slim AS build
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/src/server.js"]
```

Create `api/.dockerignore` with `node_modules` and `dist`.

- [ ] **Step 17: Verify the whole stack**

```bash
cd /Users/adib/Desktop/Tesla
docker compose up --build -d
docker compose ps
curl -s localhost:4000/health
```

Expected: `api` shows `healthy`; curl prints `{"status":"ok"}`.

- [ ] **Step 18: Commit in logical pieces and merge**

```bash
git add api/package.json api/package-lock.json api/tsconfig.json api/src api/vitest.config.ts api/test api/.dockerignore
git commit -m "build(api): scaffold express 5 api with typescript, logging and vitest"
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(db): add schema with capacity checks and one-active-ride indexes"
git add api/prisma/seed-data.ts api/prisma/seed.ts
git commit -m "feat(db): seed the banani rush-hour cast and yesterday's pooled trip"
git add api/Dockerfile docker-compose.yml docker/ .env.example
git commit -m "build(docker): add compose setup for api and postgres with health checks"
git checkout master && git merge --no-ff --no-edit feature/docker-db-schema
git push origin master feature/docker-db-schema
```

(`src/domain/fare.ts` and `geo.ts` ride along in the first commit; their tests arrive in Task 3.)

---

### Task 2: Passenger auth and web shell (`feature/passenger-auth`)

**Files:**
- Create: `api/src/http/auth.ts`, `api/src/routes/auth.ts`, `api/src/services/views.ts`, `api/test/auth.test.ts`
- Modify: `api/src/app.ts` (mount router), `api/test/helpers.ts` (add `loginAs`)
- Create: `web/` (Next.js app), `web/next.config.ts`, `web/Dockerfile`, `web/lib/{api,types,session,demo}.ts`, `web/app/{providers,page}.tsx`, `web/app/login/page.tsx`, `web/app/signup/page.tsx`, `web/components/{Header,RequireRole,PageMessage}.tsx`
- Modify: `web/app/layout.tsx`, `docker-compose.yml` (add `web`)

**Interfaces:**
- Consumes: `prisma`, `config`, error helpers (Task 1).
- Produces: `startSession(res, user)`, `endSession(res)`, `requireAuth`, `requireRole(role)`; `meView(userId)`; `authRouter`; test helper `loginAs(who)`; web `api<T>()`, `ApiError`, `taka()`, `km()`, all shared types in `web/lib/types.ts`, `useMe()`, `homeFor(role)`, `<RequireRole>`, `<PageMessage>`.
- Endpoints: `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.

- [ ] **Step 1: Branch and install**

```bash
git checkout -b feature/passenger-auth master
cd api && npm i jsonwebtoken express-rate-limit && npm i -D @types/jsonwebtoken
```

- [ ] **Step 2: Add `loginAs` to `api/test/helpers.ts`**

Add these imports and function:

```ts
import { CAST, DEMO_PASSWORD, seedBase } from '../prisma/seed-data';

export async function loginAs(who: keyof typeof CAST): Promise<Agent> {
  const agent = request.agent(app);
  await agent.post('/auth/login').send({ email: CAST[who].email, password: DEMO_PASSWORD }).expect(200);
  return agent;
}
```

- [ ] **Step 3: Write the failing tests**

`api/test/auth.test.ts`:

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { CAST } from '../prisma/seed-data';
import { app, loginAs, resetDb } from './helpers';

describe('auth', () => {
  beforeEach(resetDb);

  it('signs Nabila up as a Passenger and keeps her signed in', async () => {
    const nabila = request.agent(app);
    const res = await nabila
      .post('/auth/signup')
      .send({ name: 'Nabila', email: 'nabila@teslapool.dev', password: 'nusrats-sister' })
      .expect(201);
    expect(res.body).toMatchObject({ name: 'Nabila', role: 'PASSENGER', tesla: null });
    const me = await nabila.get('/auth/me').expect(200);
    expect(me.body.email).toBe('nabila@teslapool.dev');
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it("rejects signing up with Nusrat's email again", async () => {
    await request(app)
      .post('/auth/signup')
      .send({ name: 'Imposter', email: CAST.nusrat.email, password: 'whatever123' })
      .expect(409);
  });

  it('rejects a wrong password with the same message as an unknown email', async () => {
    const wrong = await request(app).post('/auth/login').send({ email: CAST.rafiq.email, password: 'not-his-password' }).expect(401);
    const unknown = await request(app).post('/auth/login').send({ email: 'ghost@teslapool.dev', password: 'not-his-password' }).expect(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it('rejects requests without a session', async () => {
    await request(app).get('/auth/me').expect(401);
  });

  it('returns Jashim with his Tesla', async () => {
    const jashim = await loginAs('jashim');
    const me = await jashim.get('/auth/me').expect(200);
    expect(me.body).toMatchObject({ role: 'DRIVER', tesla: { name: 'Bullet', capacity: 3, isOnline: true } });
  });

  it('logs out', async () => {
    const shirin = await loginAs('shirin');
    await shirin.post('/auth/logout').expect(204);
    await shirin.get('/auth/me').expect(401);
  });
});
```

Run: `npm test -- auth`. Expected: FAIL (`/auth/*` routes return 404).

- [ ] **Step 4: Write `api/src/http/auth.ts`**

```ts
import type { RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { config } from '../config';
import { forbidden, unauthorized } from './errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

const COOKIE = 'token';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function startSession(res: Response, user: { id: string; role: Role }) {
  const token = jwt.sign({ role: user.role }, config.JWT_SECRET, { subject: user.id, expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.COOKIE_SECURE, maxAge: WEEK_MS });
}

export function endSession(res: Response) {
  res.clearCookie(COOKIE);
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[COOKIE];
  if (!token) throw unauthorized();
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;
    req.user = { id: payload.sub!, role: payload.role };
  } catch {
    throw unauthorized('Session expired, please sign in again');
  }
  next();
};

export const requireRole =
  (role: Role): RequestHandler =>
  (req, _res, next) => {
    if (req.user?.role !== role) throw forbidden();
    next();
  };
```

- [ ] **Step 5: Write `api/src/services/views.ts`**

```ts
import { prisma } from '../db';

export const zoneView = (z: { id: number; name: string }) => ({ id: z.id, name: z.name });

export async function meView(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { tesla: true } });
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    teslapayBalancePaisa: u.teslapayBalancePaisa,
    tesla: u.tesla && {
      id: u.tesla.id,
      name: u.tesla.name,
      plate: u.tesla.plate,
      capacity: u.tesla.capacity,
      isOnline: u.tesla.isOnline,
      currentZoneId: u.tesla.currentZoneId,
    },
  };
}
```

- [ ] **Step 6: Write `api/src/routes/auth.ts`**

```ts
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config';
import { prisma } from '../db';
import { endSession, requireAuth, startSession } from '../http/auth';
import { conflict, isUniqueViolation, unauthorized } from '../http/errors';
import { meView } from '../services/views';

const Credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
});
const Signup = Credentials.extend({ name: z.string().trim().min(1).max(80) });

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
});

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export const authRouter = Router();

authRouter.post('/signup', authLimiter, async (req, res) => {
  const body = Signup.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user
    .create({ data: { name: body.name, email: body.email, passwordHash, role: 'PASSENGER' } })
    .catch((err) => {
      throw isUniqueViolation(err) ? conflict('That email is already registered') : err;
    });
  startSession(res, user);
  res.status(201).json(await meView(user.id));
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const body = Credentials.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  const ok = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Wrong email or password');
  startSession(res, user);
  res.json(await meView(user.id));
});

authRouter.post('/logout', (_req, res) => {
  endSession(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await meView(req.user!.id));
});
```

Drivers are seeded only; there is no driver signup (driver onboarding means vehicle checks, out of scope; README assumption).

- [ ] **Step 7: Mount in `api/src/app.ts`**

Add `import { authRouter } from './routes/auth';` and replace the `// Routers are mounted here by later tasks.` comment with:

```ts
  app.use('/auth', authRouter);
```

Run: `npm test`. Expected: all PASS.

- [ ] **Step 8: Commit API**

```bash
git add api
git commit -m "feat(auth): add passenger signup, login and cookie sessions"
```

- [ ] **Step 9: Scaffold the web app**

```bash
cd /Users/adib/Desktop/Tesla
npx create-next-app@latest web --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
cd web
npx shadcn@latest init -d
npx shadcn@latest add button card badge input label sonner
npm i @tanstack/react-query
```

Accept defaults for any other prompt.

- [ ] **Step 10: Write `web/next.config.ts`**

```ts
import type { NextConfig } from 'next';

// Rewrites are baked in at build time, so API_URL must exist during `next build`
// (Docker build arg locally, project env var on Vercel).
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
if (!process.env.API_URL && process.env.NODE_ENV === 'production') {
  throw new Error('API_URL must be set when building for production');
}

const nextConfig: NextConfig = {
  output: 'standalone',
  // Same-origin proxy: the session cookie stays first-party even though the API lives on another domain.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
```

- [ ] **Step 11: Write `web/lib/api.ts`**

```ts
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (hasBody ? 'POST' : 'GET'),
    headers: hasBody ? { 'content-type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const taka = (paisa: number) => `৳${(paisa / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
export const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
```

- [ ] **Step 12: Write `web/lib/types.ts`** (all shapes the API returns across the project)

```ts
export type Role = 'PASSENGER' | 'DRIVER';
export type RequestStatus = 'REQUESTED' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TripStatus = 'ACCEPTED' | 'DRIVER_ARRIVED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'TESLAPAY';

export const ACTIVE_REQUEST_STATUSES: RequestStatus[] = ['REQUESTED', 'MATCHED', 'IN_PROGRESS'];

export type Zone = { id: number; name: string };

export type Me = {
  id: string;
  name: string;
  email: string;
  role: Role;
  teslapayBalancePaisa: number;
  tesla: { id: string; name: string; plate: string; capacity: number; isOnline: boolean; currentZoneId: number | null } | null;
};

export type FareBreakdown = {
  basePaisa: number;
  distanceChargePaisa: number;
  subtotalPaisa: number;
  poolDiscountPaisa: number;
  totalPaisa: number;
};

export type FareEstimate = { pickup: Zone; dropoff: Zone; distanceM: number; solo: FareBreakdown; pooled: FareBreakdown };

export type LockedFare = { basePaisa: number; distanceChargePaisa: number; poolDiscountPaisa: number; finalFarePaisa: number };

export type RideEvent = {
  id: number;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  detail: Record<string, unknown> | null;
  actorName: string | null;
  createdAt: string;
};

export type PassengerRide = {
  id: string;
  status: RequestStatus;
  seats: number;
  allowSharing: boolean;
  paymentMethod: PaymentMethod;
  pickup: Zone;
  dropoff: Zone;
  distanceM: number;
  estimatedSoloPaisa: number;
  fare: LockedFare | null;
  paidAt: string | null;
  createdAt: string;
  trip: { status: TripStatus; driverName: string; teslaName: string; plate: string; coRiders: number | null } | null;
  events?: RideEvent[];
};

export type CompatibleRequest = {
  id: string;
  passengerName: string;
  pickup: Zone;
  dropoff: Zone;
  seats: number;
  allowSharing: boolean;
  distanceM: number;
  estimatedSoloPaisa: number;
  createdAt: string;
};

export type TripPassenger = {
  requestId: string;
  passengerName: string;
  seats: number;
  dropoff: Zone;
  status: RequestStatus;
  paymentMethod: PaymentMethod;
  finalFarePaisa: number | null;
};

export type DriverTrip = {
  id: string;
  status: TripStatus;
  capacity: number;
  seatsTaken: number;
  isSolo: boolean;
  pickup: Zone;
  createdAt: string;
  passengers: TripPassenger[];
  events?: RideEvent[];
};
```

- [ ] **Step 13: Write session helpers and demo cast**

`web/lib/session.ts`:

```ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Me, Role } from './types';

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me') });

export const homeFor = (role: Role) => (role === 'DRIVER' ? '/driver' : '/ride');
```

`web/lib/demo.ts`:

```ts
// Mirrors api/prisma/seed-data.ts. Rendered only when NEXT_PUBLIC_DEMO_MODE=true.
export const DEMO_PASSWORD = 'bullet-3-seats';

export const DEMO_CAST = [
  { name: 'Nusrat', email: 'nusrat@teslapool.dev', label: 'Passenger' },
  { name: 'Rafiq', email: 'rafiq@teslapool.dev', label: 'Passenger' },
  { name: 'Shirin', email: 'shirin@teslapool.dev', label: 'Passenger' },
  { name: 'Jashim', email: 'jashim@teslapool.dev', label: 'Driver · Bullet' },
  { name: 'Kamal', email: 'kamal@teslapool.dev', label: 'Driver · Toofan' },
];
```

- [ ] **Step 14: Write providers and shared components**

`web/app/providers.tsx`:

```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster richColors />
    </QueryClientProvider>
  );
}
```

`web/components/PageMessage.tsx`:

```tsx
export function PageMessage({ children }: { children: React.ReactNode }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{children}</p>;
}
```

`web/components/RequireRole.tsx`:

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ApiError } from '@/lib/api';
import { homeFor, useMe } from '@/lib/session';
import type { Role } from '@/lib/types';
import { PageMessage } from './PageMessage';

export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const signedOut = me.error instanceof ApiError && me.error.status === 401;
  const wrongRole = me.data !== undefined && me.data.role !== role;

  useEffect(() => {
    if (signedOut) router.replace('/login');
    else if (wrongRole) router.replace(homeFor(me.data!.role));
  }, [signedOut, wrongRole, me.data, router]);

  if (me.isPending || signedOut || wrongRole) return <PageMessage>Loading…</PageMessage>;
  if (me.isError) return <PageMessage>Could not reach the server: {me.error.message}</PageMessage>;
  return <>{children}</>;
}
```

`web/components/Header.tsx`:

```tsx
'use client';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { api, taka } from '@/lib/api';
import { useMe } from '@/lib/session';

export function Header() {
  const me = useMe();
  const qc = useQueryClient();
  const router = useRouter();

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    qc.clear();
    router.replace('/login');
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <Link href="/" className="font-semibold">
          Dhaka Tesla Pool
        </Link>
        {me.data && (
          <>
            <nav className="flex gap-3 text-sm">
              {me.data.role === 'PASSENGER' ? (
                <>
                  <Link href="/ride">Ride</Link>
                  <Link href="/rides">History</Link>
                </>
              ) : (
                <>
                  <Link href="/driver">Dashboard</Link>
                  <Link href="/driver/trips">Trips</Link>
                </>
              )}
            </nav>
            <span className="ml-auto text-sm text-muted-foreground">
              {me.data.name}
              {me.data.role === 'PASSENGER' && ` · TeslaPay ${taka(me.data.teslapayBalancePaisa)}`}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Log out
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 15: Update `web/app/layout.tsx`**

Keep the generated font imports and `<html>` element. Set `metadata` to `{ title: 'Dhaka Tesla Pool', description: 'Share a seat. Split the fare. Survive Dhaka traffic.' }`, add `import { Providers } from './providers';` and `import { Header } from '@/components/Header';`, and make the body:

```tsx
<body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}>
  <Providers>
    <Header />
    <main className="mx-auto max-w-2xl p-4">{children}</main>
  </Providers>
</body>
```

(Use whatever font variable names the generator produced.)

- [ ] **Step 16: Write home, login and signup pages**

`web/app/page.tsx`:

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageMessage } from '@/components/PageMessage';
import { homeFor, useMe } from '@/lib/session';

export default function Home() {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me.data) router.replace(homeFor(me.data.role));
    else if (me.isError) router.replace('/login');
  }, [me.data, me.isError, router]);
  return <PageMessage>Loading…</PageMessage>;
}
```

`web/app/login/page.tsx`:

```tsx
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { DEMO_CAST, DEMO_PASSWORD } from '@/lib/demo';
import { homeFor } from '@/lib/session';
import type { Me } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) => api<Me>('/auth/login', { body }),
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      router.replace(homeFor(me.role));
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate({ email, password });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Demo: sign in as someone from the Banani story</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_CAST.map((c) => (
                <Button key={c.email} variant="secondary" disabled={login.isPending} onClick={() => login.mutate({ email: c.email, password: DEMO_PASSWORD })}>
                  {c.name} · {c.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm">
          New passenger?{' '}
          <Link className="underline" href="/signup">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

`web/app/signup/page.tsx`:

```tsx
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import type { Me } from '@/lib/types';

export default function SignupPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const signup = useMutation({
    mutationFn: () => api<Me>('/auth/signup', { body: form }),
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      router.replace('/ride');
    },
    onError: (err) => toast.error(err.message),
  });

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a passenger account</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            signup.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required maxLength={80} autoComplete="name" {...field('name')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" {...field('email')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password (8+ characters)</Label>
            <Input id="password" type="password" required minLength={8} autoComplete="new-password" {...field('password')} />
          </div>
          <Button type="submit" className="w-full" disabled={signup.isPending}>
            {signup.isPending ? 'Creating account…' : 'Sign up'}
          </Button>
          <p className="text-sm">
            Already riding?{' '}
            <Link className="underline" href="/login">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 17: Write `web/Dockerfile` and add `web` to compose**

`web/Dockerfile`:

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG API_URL
ARG NEXT_PUBLIC_DEMO_MODE=false
ENV API_URL=$API_URL NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Create `web/.dockerignore` with `node_modules` and `.next`.

Add under `services:` in `docker-compose.yml`:

```yaml
  web:
    build:
      context: ./web
      args:
        API_URL: http://api:4000
        NEXT_PUBLIC_DEMO_MODE: "true"
    ports:
      - "3000:3000"
    depends_on:
      api:
        condition: service_healthy
```

- [ ] **Step 18: Verify in the browser**

```bash
cd /Users/adib/Desktop/Tesla && docker compose up --build -d
```

Open `http://localhost:3000`. Expected: redirect to `/login`, demo buttons visible. "Nusrat · Passenger" signs in and lands on `/ride` (404 page for now, header shows `Nusrat · TeslaPay ৳943` from yesterday's seeded ride). Log out returns to `/login`. Signing up as Nabila works.

- [ ] **Step 19: Commit and merge**

```bash
git add web docker-compose.yml ':!web/app/login' ':!web/app/signup' ':!web/lib/demo.ts'
git commit -m "feat(web): add next.js shell with same-origin api proxy and session hooks"
git add web/app/login web/app/signup web/lib/demo.ts
git commit -m "feat(web): add login, signup and demo cast sign-in"
git checkout master && git merge --no-ff --no-edit feature/passenger-auth
git push origin master feature/passenger-auth
```

---

### Task 3: Fare estimate (`feature/fare-estimate`)

**Files:**
- Test: `api/test/fare.test.ts`, `api/test/catalog.test.ts`
- Already created in Task 1 (verify content matches): `api/src/domain/geo.ts`, `api/src/domain/fare.ts`
- Create: `api/src/services/passenger.ts` (`estimateRide` only), `api/src/routes/catalog.ts`
- Modify: `api/src/app.ts`

**Interfaces:**
- Produces: `haversineM(a, b)`, `roadDistanceM(a, b)`, `ROAD_FACTOR`, `Point` (`geo.ts`); `calculateFare({ distanceM, seats, pooled }): FareBreakdown`, `BASE_FARE_PAISA`, `PER_KM_PAISA`, `POOL_DISCOUNT_PERCENT`, `MAX_SEATS_PER_REQUEST` (`fare.ts`); `estimateRide(pickupZoneId, dropoffZoneId, seats)` (`passenger.ts`).
- Endpoints: `GET /zones`, `GET /fare-estimate?from=&to=&seats=`.

- [ ] **Step 1: Branch**

```bash
git checkout -b feature/fare-estimate master
```

- [ ] **Step 2: Write the failing tests**

`api/test/fare.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ZONES } from '../prisma/seed-data';
import { calculateFare } from '../src/domain/fare';
import { roadDistanceM } from '../src/domain/geo';

const zone = (name: string) => ZONES.find((z) => z.name === name)!;

describe('roadDistanceM', () => {
  it('measures Banani → Mohakhali as 2.3 km and Banani → Gulshan 1 as 2.5 km', () => {
    expect(roadDistanceM(zone('Banani'), zone('Mohakhali'))).toBe(2300);
    expect(roadDistanceM(zone('Banani'), zone('Gulshan 1'))).toBe(2500);
  });
});

describe('calculateFare', () => {
  it("prices Nusrat's Banani → Mohakhali ride: ৳76 solo, ৳57 pooled", () => {
    expect(calculateFare({ distanceM: 2300, seats: 1, pooled: false })).toEqual({
      basePaisa: 3000,
      distanceChargePaisa: 4600,
      subtotalPaisa: 7600,
      poolDiscountPaisa: 0,
      totalPaisa: 7600,
    });
    expect(calculateFare({ distanceM: 2300, seats: 1, pooled: true })).toMatchObject({ poolDiscountPaisa: 1900, totalPaisa: 5700 });
  });

  it("prices Rafiq's Banani → Gulshan 1 ride: ৳80 solo, ৳60 pooled", () => {
    expect(calculateFare({ distanceM: 2500, seats: 1, pooled: false }).totalPaisa).toBe(8000);
    expect(calculateFare({ distanceM: 2500, seats: 1, pooled: true }).totalPaisa).toBe(6000);
  });

  it('charges per seat', () => {
    expect(calculateFare({ distanceM: 2300, seats: 2, pooled: true })).toMatchObject({ subtotalPaisa: 15200, poolDiscountPaisa: 3800, totalPaisa: 11400 });
  });

  it('always lands on whole paisa', () => {
    for (let distanceM = 100; distanceM <= 30_000; distanceM += 100) {
      for (const seats of [1, 2, 3]) {
        for (const pooled of [true, false]) {
          expect(Number.isInteger(calculateFare({ distanceM, seats, pooled }).totalPaisa)).toBe(true);
        }
      }
    }
  });
});
```

`api/test/catalog.test.ts`:

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, resetDb, zoneId } from './helpers';

describe('catalog', () => {
  beforeEach(resetDb);

  it('lists the Dhaka zones', async () => {
    const res = await request(app).get('/zones').expect(200);
    expect(res.body.map((z: { name: string }) => z.name)).toContain('Banani');
  });

  it('estimates Nusrat\'s ride from Banani to Mohakhali', async () => {
    const res = await request(app)
      .get('/fare-estimate')
      .query({ from: await zoneId('Banani'), to: await zoneId('Mohakhali'), seats: 1 })
      .expect(200);
    expect(res.body).toMatchObject({ distanceM: 2300, solo: { totalPaisa: 7600 }, pooled: { totalPaisa: 5700 } });
  });

  it('rejects the same pickup and destination', async () => {
    const banani = await zoneId('Banani');
    await request(app).get('/fare-estimate').query({ from: banani, to: banani }).expect(422);
  });

  it('rejects four seats', async () => {
    await request(app).get('/fare-estimate').query({ from: await zoneId('Banani'), to: await zoneId('Uttara'), seats: 4 }).expect(422);
  });
});
```

Run: `npm test -- fare catalog`. Expected: `fare.test.ts` PASS (domain files exist since Task 1), `catalog.test.ts` FAIL with 404.

- [ ] **Step 3: Confirm `api/src/domain/geo.ts`**

```ts
export type Point = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_008.8;
/** Dhaka roads are not straight lines; 1.3 is a documented, tunable guess. */
export const ROAD_FACTOR = 1.3;

export function haversineM(a: Point, b: Point) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Estimated road distance, rounded to the nearest 100 m so fares are easy to check by hand. */
export function roadDistanceM(a: Point, b: Point) {
  return Math.round((haversineM(a, b) * ROAD_FACTOR) / 100) * 100;
}
```

- [ ] **Step 4: Confirm `api/src/domain/fare.ts`**

```ts
export const BASE_FARE_PAISA = 3000; // ৳30 per seat
export const PER_KM_PAISA = 2000; // ৳20 per km per seat
export const POOL_DISCOUNT_PERCENT = 25;
export const MAX_SEATS_PER_REQUEST = 3;

export type FareBreakdown = {
  basePaisa: number;
  distanceChargePaisa: number;
  subtotalPaisa: number;
  poolDiscountPaisa: number;
  totalPaisa: number;
};

/**
 * passengerFare = (base + distanceCharge) × seats − poolDiscount, all in integer paisa.
 * distanceM is a multiple of 100, so every term is a whole number and no rounding is needed.
 */
export function calculateFare(input: { distanceM: number; seats: number; pooled: boolean }): FareBreakdown {
  const basePaisa = BASE_FARE_PAISA * input.seats;
  const distanceChargePaisa = Math.round((input.distanceM * PER_KM_PAISA) / 1000) * input.seats;
  const subtotalPaisa = basePaisa + distanceChargePaisa;
  const poolDiscountPaisa = input.pooled ? Math.round((subtotalPaisa * POOL_DISCOUNT_PERCENT) / 100) : 0;
  return { basePaisa, distanceChargePaisa, subtotalPaisa, poolDiscountPaisa, totalPaisa: subtotalPaisa - poolDiscountPaisa };
}
```

- [ ] **Step 5: Write `api/src/services/passenger.ts`**

```ts
import { prisma } from '../db';
import { calculateFare } from '../domain/fare';
import { roadDistanceM } from '../domain/geo';
import { unprocessable } from '../http/errors';
import { zoneView } from './views';

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
```

- [ ] **Step 6: Write `api/src/routes/catalog.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { MAX_SEATS_PER_REQUEST } from '../domain/fare';
import { estimateRide } from '../services/passenger';

const EstimateQuery = z.object({
  from: z.coerce.number().int(),
  to: z.coerce.number().int(),
  seats: z.coerce.number().int().min(1).max(MAX_SEATS_PER_REQUEST).default(1),
});

export const catalogRouter = Router();

catalogRouter.get('/zones', async (_req, res) => {
  res.json(await prisma.zone.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }));
});

catalogRouter.get('/fare-estimate', async (req, res) => {
  const q = EstimateQuery.parse(req.query);
  res.json(await estimateRide(q.from, q.to, q.seats));
});
```

Mount in `app.ts` below the auth router: `import { catalogRouter } from './routes/catalog';` and `app.use(catalogRouter);`.

Run: `npm test`. Expected: all PASS.

- [ ] **Step 7: Commit and merge**

```bash
git add api/test/fare.test.ts
git commit -m "test(fare): pin nusrat and rafiq pooled fares and whole-paisa rounding"
git add api/src/services/passenger.ts api/src/routes/catalog.ts api/src/app.ts api/test/catalog.test.ts
git commit -m "feat(fare): add zones list and solo/pooled fare estimate endpoint"
git checkout master && git merge --no-ff --no-edit feature/fare-estimate
git push origin master feature/fare-estimate
```

(No web work here; the request form in Task 4 consumes the endpoint.)

---

### Task 4: Ride requests (`feature/ride-requests`)

**Files:**
- Create: `api/src/domain/transitions.ts`, `api/src/services/events.ts`, `api/src/routes/passenger.ts`
- Modify: `api/src/services/passenger.ts` (create, list, get, cancel), `api/src/services/views.ts` (ride view), `api/src/app.ts`, `api/test/helpers.ts` (`requestRide`)
- Test: `api/test/transitions.test.ts`, `api/test/ride-requests.test.ts`
- Create web: `web/components/{StatusBadge,ZoneSelect,FareReceipt,RideRequestForm,ActiveRideCard}.tsx`, `web/app/ride/page.tsx`, `web/app/rides/page.tsx`, `web/app/rides/[id]/page.tsx`

**Interfaces:**
- Consumes: `estimateRide`, `calculateFare`, error helpers, `requireAuth`, `requireRole`.
- Produces: `canMoveTrip(from, to)`, `canMoveRequest(from, to)`; `recordEvent(tx, event)`; `createRideRequest`, `listPassengerRides`, `getPassengerRide`, `cancelRideRequest`; `rideInclude`, `passengerRideView(ride, coRiders)`; test helper `requestRide(agent, from, to, extra?)`.
- Endpoints: `POST /ride-requests`, `GET /ride-requests`, `GET /ride-requests/:id`, `POST /ride-requests/:id/cancel`.

- [ ] **Step 1: Branch and write failing tests**

```bash
git checkout -b feature/ride-requests master
```

`api/test/transitions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canMoveRequest, canMoveTrip } from '../src/domain/transitions';

describe('Trip lifecycle', () => {
  it('follows ACCEPTED → DRIVER_ARRIVED → STARTED → COMPLETED', () => {
    expect(canMoveTrip('ACCEPTED', 'DRIVER_ARRIVED')).toBe(true);
    expect(canMoveTrip('DRIVER_ARRIVED', 'STARTED')).toBe(true);
    expect(canMoveTrip('STARTED', 'COMPLETED')).toBe(true);
  });

  it('rejects skipping, reversing, and cancelling once started', () => {
    expect(canMoveTrip('ACCEPTED', 'STARTED')).toBe(false);
    expect(canMoveTrip('STARTED', 'DRIVER_ARRIVED')).toBe(false);
    expect(canMoveTrip('STARTED', 'CANCELLED')).toBe(false);
    expect(canMoveTrip('COMPLETED', 'CANCELLED')).toBe(false);
  });
});

describe('Ride Request lifecycle', () => {
  it('allows Requeue from MATCHED back to REQUESTED', () => {
    expect(canMoveRequest('MATCHED', 'REQUESTED')).toBe(true);
  });

  it('rejects cancelling a ride that is in progress or finished', () => {
    expect(canMoveRequest('IN_PROGRESS', 'CANCELLED')).toBe(false);
    expect(canMoveRequest('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canMoveRequest('CANCELLED', 'CANCELLED')).toBe(false);
  });
});
```

Add to `api/test/helpers.ts`:

```ts
export async function requestRide(agent: Agent, from: string, to: string, extra: Record<string, unknown> = {}) {
  const res = await agent
    .post('/ride-requests')
    .send({ pickupZoneId: await zoneId(from), dropoffZoneId: await zoneId(to), ...extra })
    .expect(201);
  return res.body.id as string;
}
```

`api/test/ride-requests.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { loginAs, requestRide, resetDb, zoneId } from './helpers';

describe('ride requests', () => {
  beforeEach(resetDb);

  it('lets Nusrat request Banani → Mohakhali and see her own estimate', async () => {
    const nusrat = await loginAs('nusrat');
    const id = await requestRide(nusrat, 'Banani', 'Mohakhali');
    const res = await nusrat.get(`/ride-requests/${id}`).expect(200);
    expect(res.body).toMatchObject({
      status: 'REQUESTED',
      seats: 1,
      allowSharing: true,
      pickup: { name: 'Banani' },
      dropoff: { name: 'Mohakhali' },
      distanceM: 2300,
      estimatedSoloPaisa: 7600,
      fare: null,
      trip: null,
    });
  });

  it('refuses a second active ride for Nusrat', async () => {
    const nusrat = await loginAs('nusrat');
    await requestRide(nusrat, 'Banani', 'Mohakhali');
    await nusrat.post('/ride-requests').send({ pickupZoneId: await zoneId('Banani'), dropoffZoneId: await zoneId('Uttara') }).expect(409);
  });

  it('rejects the same pickup and destination, and four seats', async () => {
    const nusrat = await loginAs('nusrat');
    const banani = await zoneId('Banani');
    await nusrat.post('/ride-requests').send({ pickupZoneId: banani, dropoffZoneId: banani }).expect(422);
    await nusrat.post('/ride-requests').send({ pickupZoneId: banani, dropoffZoneId: await zoneId('Uttara'), seats: 4 }).expect(422);
  });

  it("hides Nusrat's ride from Rafiq: he can neither see nor cancel it", async () => {
    const [nusrat, rafiq] = await Promise.all([loginAs('nusrat'), loginAs('rafiq')]);
    const id = await requestRide(nusrat, 'Banani', 'Mohakhali');
    await rafiq.get(`/ride-requests/${id}`).expect(404);
    await rafiq.post(`/ride-requests/${id}/cancel`).expect(404);
    const list = await rafiq.get('/ride-requests').expect(200);
    expect(list.body).toEqual([]);
  });

  it('lets Nusrat cancel while waiting, then request again', async () => {
    const nusrat = await loginAs('nusrat');
    const id = await requestRide(nusrat, 'Banani', 'Mohakhali');
    const res = await nusrat.post(`/ride-requests/${id}/cancel`).expect(200);
    expect(res.body.status).toBe('CANCELLED');
    await nusrat.post(`/ride-requests/${id}/cancel`).expect(409);
    await requestRide(nusrat, 'Banani', 'Mohakhali');
  });

  it('keeps Jashim out of passenger routes and returns 404 for malformed ids', async () => {
    const [jashim, nusrat] = await Promise.all([loginAs('jashim'), loginAs('nusrat')]);
    await jashim.post('/ride-requests').send({}).expect(403);
    await nusrat.get('/ride-requests/not-a-uuid').expect(404);
  });
});
```

Run: `npm test -- transitions ride-requests`. Expected: FAIL (modules and routes missing).

- [ ] **Step 2: Write `api/src/domain/transitions.ts`**

```ts
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
```

- [ ] **Step 3: Write `api/src/services/events.ts`**

```ts
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
```

- [ ] **Step 4: Append the ride view to `api/src/services/views.ts`**

Add `import type { Prisma } from '@prisma/client';` at the top, then append:

```ts
export const rideInclude = {
  pickupZone: true,
  dropoffZone: true,
  trip: { include: { tesla: true, driver: { select: { name: true } } } },
} satisfies Prisma.RideRequestInclude;

type RideWithRelations = Prisma.RideRequestGetPayload<{ include: typeof rideInclude }>;

/** What one Passenger may see about their own ride: never other passengers' names or fares. */
export function passengerRideView(r: RideWithRelations, coRiders: number | null) {
  return {
    id: r.id,
    status: r.status,
    seats: r.seats,
    allowSharing: r.allowSharing,
    paymentMethod: r.paymentMethod,
    pickup: zoneView(r.pickupZone),
    dropoff: zoneView(r.dropoffZone),
    distanceM: r.distanceM,
    estimatedSoloPaisa: r.estimatedSoloPaisa,
    fare:
      r.finalFarePaisa === null
        ? null
        : {
            basePaisa: r.baseFarePaisa!,
            distanceChargePaisa: r.distanceChargePaisa!,
            poolDiscountPaisa: r.poolDiscountPaisa!,
            finalFarePaisa: r.finalFarePaisa,
          },
    paidAt: r.paidAt,
    createdAt: r.createdAt,
    trip: r.trip && {
      status: r.trip.status,
      driverName: r.trip.driver.name,
      teslaName: r.trip.tesla.name,
      plate: r.trip.tesla.plate,
      coRiders,
    },
  };
}
```

- [ ] **Step 5: Append ride operations to `api/src/services/passenger.ts`**

Replace the imports with:

```ts
import type { PaymentMethod } from '@prisma/client';
import { prisma } from '../db';
import { calculateFare } from '../domain/fare';
import { roadDistanceM } from '../domain/geo';
import { canMoveRequest } from '../domain/transitions';
import { conflict, isUniqueViolation, notFound, unprocessable } from '../http/errors';
import { recordEvent } from './events';
import { passengerRideView, rideInclude, zoneView } from './views';
```

Append:

```ts
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
```

The Trip branch runs only once Accept exists (Task 6); Task 7 tests it.

- [ ] **Step 6: Write `api/src/routes/passenger.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { MAX_SEATS_PER_REQUEST } from '../domain/fare';
import { requireAuth, requireRole } from '../http/auth';
import { idParam } from '../http/errors';
import { cancelRideRequest, createRideRequest, getPassengerRide, listPassengerRides } from '../services/passenger';

const NewRide = z.object({
  pickupZoneId: z.number().int(),
  dropoffZoneId: z.number().int(),
  seats: z.number().int().min(1).max(MAX_SEATS_PER_REQUEST).default(1),
  allowSharing: z.boolean().default(true),
  paymentMethod: z.enum(['CASH', 'TESLAPAY']).default('CASH'),
});

export const passengerRouter = Router();
passengerRouter.use(requireAuth, requireRole('PASSENGER'));

passengerRouter.post('/', async (req, res) => {
  res.status(201).json(await createRideRequest(req.user!.id, NewRide.parse(req.body)));
});

passengerRouter.get('/', async (req, res) => {
  res.json(await listPassengerRides(req.user!.id));
});

passengerRouter.get('/:id', async (req, res) => {
  res.json(await getPassengerRide(req.user!.id, idParam(req.params.id, 'Ride not found')));
});

passengerRouter.post('/:id/cancel', async (req, res) => {
  res.json(await cancelRideRequest(req.user!.id, idParam(req.params.id, 'Ride not found')));
});
```

Mount in `app.ts`: `import { passengerRouter } from './routes/passenger';` and `app.use('/ride-requests', passengerRouter);`.

Run: `npm test`. Expected: all PASS.

- [ ] **Step 7: Commit API**

```bash
git add api/src/domain/transitions.ts api/test/transitions.test.ts
git commit -m "feat(ride): define trip and ride request state machines"
git add api
git commit -m "feat(ride): let passengers request, view and cancel their own rides"
```

- [ ] **Step 8: Write web components**

`web/components/StatusBadge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';

const LABELS: Record<string, string> = {
  REQUESTED: 'Waiting',
  MATCHED: 'Matched',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ACCEPTED: 'Heading to pickup',
  DRIVER_ARRIVED: 'Driver arrived',
  STARTED: 'Trip started',
};

export function StatusBadge({ status }: { status: string }) {
  const variant = status === 'CANCELLED' ? 'destructive' : status === 'COMPLETED' ? 'secondary' : 'default';
  return <Badge variant={variant}>{LABELS[status] ?? status}</Badge>;
}
```

`web/components/ZoneSelect.tsx`:

```tsx
import { Label } from '@/components/ui/label';
import type { Zone } from '@/lib/types';

export const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm';

export function ZoneSelect(props: { id: string; label: string; zones: Zone[]; value: number | undefined; onChange: (id: number) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <select id={props.id} className={selectClass} value={props.value ?? ''} onChange={(e) => props.onChange(Number(e.target.value))}>
        <option value="" disabled>
          Choose a zone
        </option>
        {props.zones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

`web/components/FareReceipt.tsx`:

```tsx
import { taka } from '@/lib/api';
import type { LockedFare } from '@/lib/types';

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'border-t pt-1 font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function FareReceipt({ fare }: { fare: LockedFare }) {
  return (
    <dl className="space-y-1 text-sm">
      <Row label="Base fare" value={taka(fare.basePaisa)} />
      <Row label="Distance charge" value={taka(fare.distanceChargePaisa)} />
      {fare.poolDiscountPaisa > 0 && <Row label="Pool discount (25%)" value={`−${taka(fare.poolDiscountPaisa)}`} />}
      <Row label="Your fare" value={taka(fare.finalFarePaisa)} strong />
    </dl>
  );
}
```

`web/components/RideRequestForm.tsx`:

```tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { api, km, taka } from '@/lib/api';
import type { FareEstimate, PassengerRide, Zone } from '@/lib/types';
import { PageMessage } from './PageMessage';
import { selectClass, ZoneSelect } from './ZoneSelect';

export function RideRequestForm() {
  const qc = useQueryClient();
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api<Zone[]>('/zones'), staleTime: Infinity });
  const [pickupZoneId, setPickup] = useState<number>();
  const [dropoffZoneId, setDropoff] = useState<number>();
  const [seats, setSeats] = useState(1);
  const [allowSharing, setAllowSharing] = useState(true);

  const sameZone = pickupZoneId !== undefined && pickupZoneId === dropoffZoneId;
  const ready = pickupZoneId !== undefined && dropoffZoneId !== undefined && !sameZone;

  const estimate = useQuery({
    queryKey: ['estimate', pickupZoneId, dropoffZoneId, seats],
    queryFn: () => api<FareEstimate>(`/fare-estimate?from=${pickupZoneId}&to=${dropoffZoneId}&seats=${seats}`),
    enabled: ready,
  });

  const request = useMutation({
    mutationFn: () => api<PassengerRide>('/ride-requests', { body: { pickupZoneId, dropoffZoneId, seats, allowSharing } }),
    onSuccess: () => {
      toast.success('Ride requested');
      qc.invalidateQueries({ queryKey: ['rides'] });
    },
    onError: (err) => toast.error(err.message),
  });

  if (zones.isPending) return <PageMessage>Loading zones…</PageMessage>;
  if (zones.isError) return <PageMessage>Could not load zones: {zones.error.message}</PageMessage>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where to?</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate();
          }}
        >
          <ZoneSelect id="pickup" label="Pickup" zones={zones.data} value={pickupZoneId} onChange={setPickup} />
          <ZoneSelect id="dropoff" label="Destination" zones={zones.data} value={dropoffZoneId} onChange={setDropoff} />
          {sameZone && <p className="text-sm text-destructive">Pickup and destination must be different.</p>}

          <div className="space-y-1">
            <Label htmlFor="seats">Seats</Label>
            <select id="seats" className={selectClass} value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowSharing} onChange={(e) => setAllowSharing(e.target.checked)} />
            Allow sharing (25% off if the Tesla is pooled)
          </label>

          {ready &&
            (estimate.isPending ? (
              <p className="text-sm text-muted-foreground">Calculating fare…</p>
            ) : estimate.isError ? (
              <p className="text-sm text-destructive">{estimate.error.message}</p>
            ) : (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p>
                  {km(estimate.data.distanceM)} · Solo {taka(estimate.data.solo.totalPaisa)}
                  {allowSharing && ` · If pooled ${taka(estimate.data.pooled.totalPaisa)}`}
                </p>
                <p className="text-muted-foreground">Your final fare locks when the trip starts.</p>
              </div>
            ))}

          <Button type="submit" className="w-full" disabled={!ready || request.isPending}>
            {request.isPending ? 'Requesting…' : 'Request ride'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

`web/components/ActiveRideCard.tsx`:

```tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, taka } from '@/lib/api';
import type { PassengerRide } from '@/lib/types';
import { FareReceipt } from './FareReceipt';
import { PageMessage } from './PageMessage';
import { StatusBadge } from './StatusBadge';

function headline(r: PassengerRide) {
  if (r.status === 'REQUESTED') return 'Waiting for a Tesla to accept your ride';
  if (r.status === 'MATCHED' && r.trip?.status === 'DRIVER_ARRIVED') return `${r.trip.teslaName} is waiting for you at ${r.pickup.name}`;
  if (r.status === 'MATCHED' && r.trip) return `${r.trip.driverName} is heading to you in ${r.trip.teslaName}`;
  if (r.status === 'IN_PROGRESS') return `On the way to ${r.dropoff.name}`;
  return '';
}

export function ActiveRideCard({ rideId }: { rideId: string }) {
  const qc = useQueryClient();
  const ride = useQuery({ queryKey: ['ride', rideId], queryFn: () => api<PassengerRide>(`/ride-requests/${rideId}`), refetchInterval: 3000 });
  const cancel = useMutation({
    mutationFn: () => api<PassengerRide>(`/ride-requests/${rideId}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      toast('Ride cancelled');
      qc.invalidateQueries({ queryKey: ['rides'] });
      qc.invalidateQueries({ queryKey: ['ride', rideId] });
    },
    onError: (err) => toast.error(err.message),
  });

  if (ride.isPending) return <PageMessage>Loading your ride…</PageMessage>;
  if (ride.isError) return <PageMessage>{ride.error.message}</PageMessage>;
  const r = ride.data;
  const cancellable = r.status === 'REQUESTED' || (r.status === 'MATCHED' && r.trip?.status === 'ACCEPTED');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          {r.pickup.name} → {r.dropoff.name}
        </CardTitle>
        <StatusBadge status={r.status} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-base">{headline(r)}</p>
        {r.trip && (
          <p className="text-muted-foreground">
            {r.trip.teslaName} · {r.trip.plate}
          </p>
        )}
        {!!r.trip?.coRiders && (
          <Badge variant="outline">
            Sharing with {r.trip.coRiders} other passenger{r.trip.coRiders > 1 ? 's' : ''}
          </Badge>
        )}
        {r.fare ? (
          <FareReceipt fare={r.fare} />
        ) : (
          <p>
            Estimated {taka(r.estimatedSoloPaisa)} solo{r.allowSharing && ', 25% off if pooled'}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {cancellable && (
            <Button variant="destructive" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel ride
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/rides/${r.id}`}>Details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 9: Write passenger pages**

`web/app/ride/page.tsx`:

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { ActiveRideCard } from '@/components/ActiveRideCard';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { RideRequestForm } from '@/components/RideRequestForm';
import { api } from '@/lib/api';
import { ACTIVE_REQUEST_STATUSES, type PassengerRide } from '@/lib/types';

function RideHome() {
  const rides = useQuery({ queryKey: ['rides'], queryFn: () => api<PassengerRide[]>('/ride-requests'), refetchInterval: 3000 });
  if (rides.isPending) return <PageMessage>Loading your rides…</PageMessage>;
  if (rides.isError) return <PageMessage>{rides.error.message}</PageMessage>;
  const active = rides.data.find((r) => ACTIVE_REQUEST_STATUSES.includes(r.status));
  return active ? <ActiveRideCard rideId={active.id} /> : <RideRequestForm />;
}

export default function RidePage() {
  return (
    <RequireRole role="PASSENGER">
      <RideHome />
    </RequireRole>
  );
}
```

`web/app/rides/page.tsx`:

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { StatusBadge } from '@/components/StatusBadge';
import { api, taka } from '@/lib/api';
import type { PassengerRide } from '@/lib/types';

function History() {
  const rides = useQuery({ queryKey: ['rides'], queryFn: () => api<PassengerRide[]>('/ride-requests') });
  if (rides.isPending) return <PageMessage>Loading history…</PageMessage>;
  if (rides.isError) return <PageMessage>{rides.error.message}</PageMessage>;
  if (!rides.data.length)
    return (
      <PageMessage>
        No rides yet.{' '}
        <Link className="underline" href="/ride">
          Request your first ride
        </Link>
      </PageMessage>
    );
  return (
    <ul className="space-y-2">
      {rides.data.map((r) => (
        <li key={r.id}>
          <Link href={`/rides/${r.id}`} className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted">
            <div>
              <p className="font-medium">
                {r.pickup.name} → {r.dropoff.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()} · {r.seats} seat{r.seats > 1 ? 's' : ''}
              </p>
            </div>
            <div className="space-y-1 text-right">
              <StatusBadge status={r.status} />
              <p className="text-sm">{r.fare ? taka(r.fare.finalFarePaisa) : `~${taka(r.estimatedSoloPaisa)}`}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function RidesPage() {
  return (
    <RequireRole role="PASSENGER">
      <h1 className="mb-4 text-xl font-semibold">Your rides</h1>
      <History />
    </RequireRole>
  );
}
```

`web/app/rides/[id]/page.tsx`:

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FareReceipt } from '@/components/FareReceipt';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { StatusBadge } from '@/components/StatusBadge';
import { api, km, taka } from '@/lib/api';
import type { PassengerRide } from '@/lib/types';

function RideDetail({ id }: { id: string }) {
  const ride = useQuery({ queryKey: ['ride', id], queryFn: () => api<PassengerRide>(`/ride-requests/${id}`) });
  if (ride.isPending) return <PageMessage>Loading ride…</PageMessage>;
  if (ride.isError) return <PageMessage>{ride.error.message}</PageMessage>;
  const r = ride.data;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>
            {r.pickup.name} → {r.dropoff.name}
          </CardTitle>
          <StatusBadge status={r.status} />
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {new Date(r.createdAt).toLocaleString()} · {km(r.distanceM)} · {r.seats} seat{r.seats > 1 ? 's' : ''} ·{' '}
            {r.paymentMethod === 'TESLAPAY' ? 'TeslaPay' : 'Cash'}
          </p>
          {r.trip && (
            <p>
              {r.trip.driverName} · {r.trip.teslaName} ({r.trip.plate})
              {!!r.trip.coRiders && ` · pooled with ${r.trip.coRiders} other`}
            </p>
          )}
          {r.fare ? <FareReceipt fare={r.fare} /> : <p>Estimated {taka(r.estimatedSoloPaisa)} solo</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RideDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireRole role="PASSENGER">
      <RideDetail id={id} />
    </RequireRole>
  );
}
```

- [ ] **Step 10: Verify and merge**

`cd web && npm run dev` (API running via `cd api && npm run dev`). As Nusrat: pick Banani → Mohakhali; estimate shows `2.3 km · Solo ৳76 · If pooled ৳57`; request; card shows "Waiting for a Tesla…"; cancel works; history lists yesterday's ride at ৳57 and today's cancelled one. Check a 375 px wide window: no horizontal scroll.

```bash
git add web
git commit -m "feat(web): add passenger ride request, live status card and history"
git checkout master && git merge --no-ff --no-edit feature/ride-requests
git push origin master feature/ride-requests
```

---

### Task 5: Driver status and Compatible requests (`feature/driver-flow`)

**Files:**
- Create: `api/src/domain/compatibility.ts`, `api/src/services/driver.ts`, `api/src/routes/driver.ts`, `api/src/routes/trips.ts`
- Modify: `api/src/services/views.ts` (trip view), `api/src/app.ts`, `api/test/helpers.ts` (`goOnline`)
- Test: `api/test/compatibility.test.ts`, `api/test/driver.test.ts`
- Create web: `web/components/DriverStatusCard.tsx`, `web/app/driver/page.tsx`, `web/app/driver/trips/page.tsx`, `web/app/driver/trips/[id]/page.tsx`

**Interfaces:**
- Produces: `TripSnapshot`, `RequestSnapshot`, `MAX_DESTINATION_SPREAD_M`, `isCompatible(trip, request)`, `destinationsCompatible(existing, candidate)`; `ACTIVE_TRIP_STATUSES`, `setDriverStatus`, `getActiveTrip`, `listCompatibleRequests`, `getDriverTrip`, `listDriverTrips`; `tripInclude`, `driverTripView`; test helper `goOnline(agent, zone)`.
- Endpoints: `PATCH /driver/status`, `GET /driver/trip`, `GET /driver/requests`, `GET /trips`, `GET /trips/:id`.

- [ ] **Step 1: Branch and write failing tests**

```bash
git checkout -b feature/driver-flow master
```

`api/test/compatibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ZONES } from '../prisma/seed-data';
import { isCompatible, type RequestSnapshot, type TripSnapshot } from '../src/domain/compatibility';

const zone = (name: string) => ZONES.find((z) => z.name === name)!;
const BANANI = 1;
const bullet = (over: Partial<TripSnapshot> = {}): TripSnapshot => ({
  status: 'ACCEPTED',
  pickupZoneId: BANANI,
  capacity: 3,
  seatsTaken: 0,
  isSolo: false,
  destinations: [],
  ...over,
});
const ride = (to: string, over: Partial<RequestSnapshot> = {}): RequestSnapshot => ({
  pickupZoneId: BANANI,
  seats: 1,
  allowSharing: true,
  dropoff: zone(to),
  ...over,
});
const withNusrat = (over: Partial<TripSnapshot> = {}) => bullet({ seatsTaken: 1, destinations: [zone('Mohakhali')], ...over });

describe('isCompatible', () => {
  it("lets Rafiq (to Gulshan 1) join Nusrat's Trip (to Mohakhali): 1.2 km apart", () => {
    expect(isCompatible(withNusrat(), ride('Gulshan 1'))).toBe(true);
  });
  it('rejects Uttara, 11 km from Mohakhali', () => {
    expect(isCompatible(withNusrat(), ride('Uttara'))).toBe(false);
  });
  it('rejects more seats than are free', () => {
    expect(isCompatible(withNusrat({ seatsTaken: 2 }), ride('Gulshan 1', { seats: 2 }))).toBe(false);
  });
  it('rejects joining a Solo Request, and a Solo Request joining others', () => {
    expect(isCompatible(withNusrat({ isSolo: true }), ride('Gulshan 1'))).toBe(false);
    expect(isCompatible(withNusrat(), ride('Gulshan 1', { allowSharing: false }))).toBe(false);
  });
  it('accepts a Solo Request into an empty Tesla', () => {
    expect(isCompatible(bullet(), ride('Uttara', { allowSharing: false }))).toBe(true);
  });
  it('rejects another pickup zone, and any join after the driver arrives', () => {
    expect(isCompatible(withNusrat(), ride('Gulshan 1', { pickupZoneId: 2 }))).toBe(false);
    expect(isCompatible(withNusrat({ status: 'DRIVER_ARRIVED' }), ride('Gulshan 1'))).toBe(false);
  });
});
```

Add to `api/test/helpers.ts`:

```ts
export async function goOnline(agent: Agent, zone: string) {
  await agent.patch('/driver/status').send({ isOnline: true, currentZoneId: await zoneId(zone) }).expect(200);
}
```

`api/test/driver.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { goOnline, loginAs, requestRide, resetDb, zoneId } from './helpers';

describe('driver dashboard', () => {
  beforeEach(resetDb);

  it("lists only requests waiting in Jashim's zone", async () => {
    const [nusrat, shirin, jashim] = await Promise.all([loginAs('nusrat'), loginAs('shirin'), loginAs('jashim')]);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali');
    await requestRide(shirin, 'Gulshan 1', 'Banani');
    const res = await jashim.get('/driver/requests').expect(200);
    expect(res.body).toEqual([expect.objectContaining({ id: n, passengerName: 'Nusrat', seats: 1, estimatedSoloPaisa: 7600 })]);
  });

  it('shows nothing while offline', async () => {
    const [nusrat, jashim] = await Promise.all([loginAs('nusrat'), loginAs('jashim')]);
    await requestRide(nusrat, 'Banani', 'Mohakhali');
    await jashim.patch('/driver/status').send({ isOnline: false, currentZoneId: await zoneId('Banani') }).expect(200);
    expect((await jashim.get('/driver/requests').expect(200)).body).toEqual([]);
  });

  it("hides a 3-seat request from Kamal's 2-seat Toofan but not from Bullet", async () => {
    const [rafiq, kamal, jashim] = await Promise.all([loginAs('rafiq'), loginAs('kamal'), loginAs('jashim')]);
    await goOnline(kamal, 'Banani');
    await requestRide(rafiq, 'Banani', 'Gulshan 1', { seats: 3 });
    expect((await kamal.get('/driver/requests').expect(200)).body).toEqual([]);
    expect((await jashim.get('/driver/requests').expect(200)).body).toHaveLength(1);
  });

  it('has no current trip before accepting anyone', async () => {
    const jashim = await loginAs('jashim');
    const res = await jashim.get('/driver/trip').expect(200);
    expect(res.text).toBe('null');
  });

  it('keeps passengers out of driver routes', async () => {
    const nusrat = await loginAs('nusrat');
    await nusrat.get('/driver/requests').expect(403);
    await nusrat.get('/trips').expect(403);
  });
});
```

Run: `npm test -- compatibility driver`. Expected: FAIL.

- [ ] **Step 2: Write `api/src/domain/compatibility.ts`**

```ts
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
```

- [ ] **Step 3: Append the trip view to `api/src/services/views.ts`**

```ts
export const tripInclude = {
  pickupZone: true,
  requests: {
    where: { status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'asc' },
    include: { passenger: { select: { name: true } }, dropoffZone: true },
  },
} satisfies Prisma.TripInclude;

export type TripWithRelations = Prisma.TripGetPayload<{ include: typeof tripInclude }>;

export function driverTripView(t: TripWithRelations) {
  return {
    id: t.id,
    status: t.status,
    capacity: t.capacity,
    seatsTaken: t.seatsTaken,
    isSolo: t.isSolo,
    pickup: zoneView(t.pickupZone),
    createdAt: t.createdAt,
    passengers: t.requests.map((r) => ({
      requestId: r.id,
      passengerName: r.passenger.name,
      seats: r.seats,
      dropoff: zoneView(r.dropoffZone),
      status: r.status,
      paymentMethod: r.paymentMethod,
      finalFarePaisa: r.finalFarePaisa,
    })),
  };
}
```

- [ ] **Step 4: Write `api/src/services/driver.ts`**

```ts
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
```

- [ ] **Step 5: Write routers**

`api/src/routes/driver.ts`:

```ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../http/auth';
import { getActiveTrip, listCompatibleRequests, setDriverStatus } from '../services/driver';

const DriverStatus = z.object({ isOnline: z.boolean(), currentZoneId: z.number().int() });

export const driverRouter = Router();
driverRouter.use(requireAuth, requireRole('DRIVER'));

driverRouter.patch('/status', async (req, res) => {
  res.json(await setDriverStatus(req.user!.id, DriverStatus.parse(req.body)));
});

driverRouter.get('/trip', async (req, res) => {
  res.json(await getActiveTrip(req.user!.id));
});

driverRouter.get('/requests', async (req, res) => {
  res.json(await listCompatibleRequests(req.user!.id));
});
```

`api/src/routes/trips.ts`:

```ts
import { Router } from 'express';
import { requireAuth, requireRole } from '../http/auth';
import { idParam } from '../http/errors';
import { getDriverTrip, listDriverTrips } from '../services/driver';

export const tripsRouter = Router();
tripsRouter.use(requireAuth, requireRole('DRIVER'));

tripsRouter.get('/', async (req, res) => {
  res.json(await listDriverTrips(req.user!.id));
});

tripsRouter.get('/:id', async (req, res) => {
  res.json(await getDriverTrip(req.user!.id, idParam(req.params.id, 'Trip not found')));
});
```

Mount in `app.ts`: `app.use('/driver', driverRouter);` and `app.use('/trips', tripsRouter);` with their imports.

Run: `npm test`. Expected: all PASS.

- [ ] **Step 6: Commit API**

```bash
git add api/src/domain/compatibility.ts api/test/compatibility.test.ts
git commit -m "feat(pool): define the compatible-request rule for shared trips"
git add api
git commit -m "feat(driver): add online status, zone and compatible request list"
```

- [ ] **Step 7: Write web**

`web/components/DriverStatusCard.tsx`:

```tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { Me, Zone } from '@/lib/types';
import { ZoneSelect } from './ZoneSelect';

export function DriverStatusCard({ tesla }: { tesla: NonNullable<Me['tesla']> }) {
  const qc = useQueryClient();
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api<Zone[]>('/zones'), staleTime: Infinity });
  const update = useMutation({
    mutationFn: (body: { isOnline: boolean; currentZoneId: number }) => api<Me>('/driver/status', { method: 'PATCH', body }),
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      qc.invalidateQueries({ queryKey: ['driver-requests'] });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          {tesla.name} · {tesla.capacity} seats
        </CardTitle>
        <Badge variant={tesla.isOnline ? 'default' : 'outline'}>{tesla.isOnline ? 'Online' : 'Offline'}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {zones.data && (
          <ZoneSelect
            id="zone"
            label="Current zone"
            zones={zones.data}
            value={tesla.currentZoneId ?? undefined}
            onChange={(id) => update.mutate({ isOnline: tesla.isOnline, currentZoneId: id })}
          />
        )}
        <Button
          className="w-full"
          variant={tesla.isOnline ? 'outline' : 'default'}
          disabled={update.isPending || tesla.currentZoneId === null}
          onClick={() => update.mutate({ isOnline: !tesla.isOnline, currentZoneId: tesla.currentZoneId! })}
        >
          {tesla.isOnline ? 'Go offline' : 'Go online'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

`web/app/driver/page.tsx` (Task 6 replaces this file):

```tsx
'use client';
import { DriverStatusCard } from '@/components/DriverStatusCard';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { useMe } from '@/lib/session';

function DriverHome() {
  const tesla = useMe().data?.tesla;
  if (!tesla) return <PageMessage>No Tesla is registered to this driver.</PageMessage>;
  return <DriverStatusCard tesla={tesla} />;
}

export default function DriverPage() {
  return (
    <RequireRole role="DRIVER">
      <DriverHome />
    </RequireRole>
  );
}
```

`web/app/driver/trips/page.tsx`:

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import type { DriverTrip } from '@/lib/types';

function Trips() {
  const trips = useQuery({ queryKey: ['driver-trips'], queryFn: () => api<DriverTrip[]>('/trips') });
  if (trips.isPending) return <PageMessage>Loading trips…</PageMessage>;
  if (trips.isError) return <PageMessage>{trips.error.message}</PageMessage>;
  if (!trips.data.length) return <PageMessage>No trips yet. Go online and accept a request.</PageMessage>;
  return (
    <ul className="space-y-2">
      {trips.data.map((t) => (
        <li key={t.id}>
          <Link href={`/driver/trips/${t.id}`} className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted">
            <div>
              <p className="font-medium">
                From {t.pickup.name} · {t.passengers.map((p) => p.passengerName).join(', ') || 'no passengers'}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(t.createdAt).toLocaleString()} · seats {t.seatsTaken}/{t.capacity}
              </p>
            </div>
            <StatusBadge status={t.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function DriverTripsPage() {
  return (
    <RequireRole role="DRIVER">
      <h1 className="mb-4 text-xl font-semibold">Your trips</h1>
      <Trips />
    </RequireRole>
  );
}
```

`web/app/driver/trips/[id]/page.tsx`:

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { StatusBadge } from '@/components/StatusBadge';
import { api, taka } from '@/lib/api';
import type { DriverTrip } from '@/lib/types';

function TripDetail({ id }: { id: string }) {
  const trip = useQuery({ queryKey: ['driver-trip', id], queryFn: () => api<DriverTrip>(`/trips/${id}`) });
  if (trip.isPending) return <PageMessage>Loading trip…</PageMessage>;
  if (trip.isError) return <PageMessage>{trip.error.message}</PageMessage>;
  const t = trip.data;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Trip from {t.pickup.name}</CardTitle>
          <StatusBadge status={t.status} />
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            {new Date(t.createdAt).toLocaleString()} · seats {t.seatsTaken}/{t.capacity}
          </p>
          <ul className="divide-y">
            {t.passengers.map((p) => (
              <li key={p.requestId} className="flex justify-between py-2">
                <span>
                  {p.passengerName} → {p.dropoff.name} · {p.seats} seat{p.seats > 1 ? 's' : ''}
                </span>
                <span>{p.finalFarePaisa !== null ? taka(p.finalFarePaisa) : <StatusBadge status={p.status} />}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DriverTripPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireRole role="DRIVER">
      <TripDetail id={id} />
    </RequireRole>
  );
}
```

- [ ] **Step 8: Verify and merge**

As Jashim: dashboard shows "Bullet · 3 seats · Online", zone Banani; toggling offline/online works; `/driver/trips` shows yesterday's trip with Nusrat and Rafiq; its detail shows ৳57 and ৳60.

```bash
git add web
git commit -m "feat(web): add driver dashboard status card and trip history"
git checkout master && git merge --no-ff --no-edit feature/driver-flow
git push origin master feature/driver-flow
```

---

### Task 6: Accept and pool with capacity safety (`feature/tesla-pooling`)

**Files:**
- Modify: `api/src/services/driver.ts` (append `acceptRideRequest`), `api/src/routes/driver.ts`, `api/test/helpers.ts` (`poolNusratAndRafiq`)
- Test: `api/test/pooling.test.ts`
- Create web: `web/components/CompatibleRequests.tsx`, `web/components/CurrentTripPanel.tsx`
- Replace web: `web/app/driver/page.tsx`

**Interfaces:**
- Consumes: `destinationsCompatible`, `recordEvent`, `getDriverTrip`, `ACTIVE_TRIP_STATUSES`.
- Produces: `acceptRideRequest(driverId, requestId)` returning the driver trip view; test helper `poolNusratAndRafiq(nusratExtra?)`.
- Endpoint: `POST /driver/requests/:id/accept`.

- [ ] **Step 1: Branch and write failing tests**

```bash
git checkout -b feature/tesla-pooling master
```

Add to `api/test/helpers.ts`:

```ts
/** The Banani story: Nusrat (to Mohakhali) and Rafiq (to Gulshan 1) share Bullet. */
export async function poolNusratAndRafiq(nusratExtra: Record<string, unknown> = {}) {
  const [nusrat, rafiq, jashim] = await Promise.all([loginAs('nusrat'), loginAs('rafiq'), loginAs('jashim')]);
  const n = await requestRide(nusrat, 'Banani', 'Mohakhali', nusratExtra);
  const r = await requestRide(rafiq, 'Banani', 'Gulshan 1');
  const trip = await jashim.post(`/driver/requests/${n}/accept`).expect(200);
  await jashim.post(`/driver/requests/${r}/accept`).expect(200);
  return { nusrat, rafiq, jashim, n, r, tripId: trip.body.id as string };
}
```

`api/test/pooling.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { goOnline, loginAs, poolNusratAndRafiq, requestRide, resetDb } from './helpers';

describe('pooling Bullet', () => {
  beforeEach(resetDb);

  it('puts Nusrat and Rafiq on one Trip with 2 of 3 seats taken', async () => {
    const { jashim, tripId } = await poolNusratAndRafiq();
    const trip = await jashim.get('/driver/trip').expect(200);
    expect(trip.body).toMatchObject({ id: tripId, status: 'ACCEPTED', seatsTaken: 2, capacity: 3 });
    expect(trip.body.passengers.map((p: { passengerName: string }) => p.passengerName)).toEqual(['Nusrat', 'Rafiq']);
  });

  it("shows Nusrat she is sharing, without Rafiq's name or fare", async () => {
    const { nusrat, n } = await poolNusratAndRafiq();
    const ride = await nusrat.get(`/ride-requests/${n}`).expect(200);
    expect(ride.body.status).toBe('MATCHED');
    expect(ride.body.trip).toEqual({ status: 'ACCEPTED', driverName: 'Jashim', teslaName: 'Bullet', plate: expect.any(String), coRiders: 1 });
    expect(JSON.stringify(ride.body)).not.toContain('Rafiq');
  });

  it("never seats more passengers than Bullet's 3 seats", async () => {
    const [rafiq, nusrat, jashim] = await Promise.all([loginAs('rafiq'), loginAs('nusrat'), loginAs('jashim')]);
    const r = await requestRide(rafiq, 'Banani', 'Gulshan 1', { seats: 2 });
    await jashim.post(`/driver/requests/${r}/accept`).expect(200);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali', { seats: 2 });
    expect((await jashim.get('/driver/requests').expect(200)).body).toEqual([]);
    await jashim.post(`/driver/requests/${n}/accept`).expect(409);
    const trip = await prisma.trip.findFirstOrThrow();
    expect(trip.seatsTaken).toBe(2);
  });

  it('lets exactly one of Nusrat and Shirin take the last seat when both are accepted at the same instant', async () => {
    const [rafiq, nusrat, shirin] = await Promise.all([loginAs('rafiq'), loginAs('nusrat'), loginAs('shirin')]);
    // Jashim on two devices, so the two accepts really are separate concurrent requests.
    const [phone, tablet] = await Promise.all([loginAs('jashim'), loginAs('jashim')]);
    const r = await requestRide(rafiq, 'Banani', 'Gulshan 1', { seats: 2 });
    await phone.post(`/driver/requests/${r}/accept`).expect(200);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali');
    const s = await requestRide(shirin, 'Banani', 'Gulshan 2');

    const results = await Promise.all([phone.post(`/driver/requests/${n}/accept`), tablet.post(`/driver/requests/${s}/accept`)]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    const trip = await prisma.trip.findFirstOrThrow();
    expect(trip.seatsTaken).toBe(3);
    expect(await prisma.rideRequest.count({ where: { tripId: trip.id, status: 'MATCHED' } })).toBe(2);
    expect(await prisma.rideRequest.count({ where: { status: 'REQUESTED' } })).toBe(1);
  });

  it("lets only one Driver take Nusrat's request when Jashim and Kamal race", async () => {
    const [nusrat, jashim, kamal] = await Promise.all([loginAs('nusrat'), loginAs('jashim'), loginAs('kamal')]);
    await goOnline(kamal, 'Banani');
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali');

    const results = await Promise.all([jashim.post(`/driver/requests/${n}/accept`), kamal.post(`/driver/requests/${n}/accept`)]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await prisma.trip.count()).toBe(1); // the loser's Trip rolled back with its transaction
  });

  it('keeps a Solo Request alone', async () => {
    const [nusrat, rafiq, jashim] = await Promise.all([loginAs('nusrat'), loginAs('rafiq'), loginAs('jashim')]);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali', { allowSharing: false });
    await jashim.post(`/driver/requests/${n}/accept`).expect(200);
    const r = await requestRide(rafiq, 'Banani', 'Gulshan 1');
    await jashim.post(`/driver/requests/${r}/accept`).expect(409);
  });

  it('refuses to pool destinations more than 3 km apart', async () => {
    const [nusrat, shirin, jashim] = await Promise.all([loginAs('nusrat'), loginAs('shirin'), loginAs('jashim')]);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali');
    await jashim.post(`/driver/requests/${n}/accept`).expect(200);
    const s = await requestRide(shirin, 'Banani', 'Uttara');
    await jashim.post(`/driver/requests/${s}/accept`).expect(409);
  });

  it('has the database itself reject a capacity breach', async () => {
    const { tripId } = await poolNusratAndRafiq();
    await expect(prisma.trip.update({ where: { id: tripId }, data: { seatsTaken: 4 } })).rejects.toThrow(/trips_seats_within_capacity/);
  });
});
```

Run: `npm test -- pooling`. Expected: FAIL (accept route missing).

- [ ] **Step 2: Append `acceptRideRequest` to `api/src/services/driver.ts`**

Update imports:

```ts
import { destinationsCompatible, isCompatible, type TripSnapshot } from '../domain/compatibility';
import { recordEvent } from './events';
```

Append:

```ts
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

    // Checked after the claim: the Trip row is locked, so its passenger list cannot change under us.
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
```

Any `throw` rolls back the whole transaction, including a freshly inserted empty Trip and the request flip.

- [ ] **Step 3: Add the route to `api/src/routes/driver.ts`**

```ts
import { idParam } from '../http/errors';
import { acceptRideRequest, getActiveTrip, listCompatibleRequests, setDriverStatus } from '../services/driver';

driverRouter.post('/requests/:id/accept', async (req, res) => {
  res.json(await acceptRideRequest(req.user!.id, idParam(req.params.id, 'Ride request not found')));
});
```

Run: `npm test`. Expected: all PASS. Run the pooling file 5 times (`for i in 1 2 3 4 5; do npm test -- pooling || break; done`) to show the race tests are not flaky.

- [ ] **Step 4: Commit API**

```bash
git add api/test/pooling.test.ts api/test/helpers.ts
git commit -m "test(pool): cover bullet capacity, last-seat race and double accept"
git add api/src
git commit -m "feat(pool): enforce bullet's seat capacity with an atomic seat claim"
```

- [ ] **Step 5: Write web components**

`web/components/CompatibleRequests.tsx`:

```tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api, km, taka } from '@/lib/api';
import type { CompatibleRequest, DriverTrip } from '@/lib/types';
import { PageMessage } from './PageMessage';

export function CompatibleRequests({ online }: { online: boolean }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['driver-requests'],
    queryFn: () => api<CompatibleRequest[]>('/driver/requests'),
    refetchInterval: 3000,
    enabled: online,
  });
  const accept = useMutation({
    mutationFn: (id: string) => api<DriverTrip>(`/driver/requests/${id}/accept`, { method: 'POST' }),
    onSuccess: (trip) => {
      qc.setQueryData(['driver-trip'], trip);
      qc.invalidateQueries({ queryKey: ['driver-requests'] });
    },
    onError: (err) => {
      toast.error(err.message);
      qc.invalidateQueries({ queryKey: ['driver-requests'] });
    },
  });

  if (!online) return <PageMessage>Go online to see ride requests.</PageMessage>;
  if (list.isPending) return <PageMessage>Looking for requests…</PageMessage>;
  if (list.isError) return <PageMessage>{list.error.message}</PageMessage>;
  if (!list.data.length) return <PageMessage>No compatible requests right now.</PageMessage>;

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">Requests you can take</h2>
      {list.data.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium">
                {r.passengerName} · {r.seats} seat{r.seats > 1 ? 's' : ''}
                {!r.allowSharing && ' · solo'}
              </p>
              <p className="text-muted-foreground">
                {r.pickup.name} → {r.dropoff.name} · {km(r.distanceM)} · {taka(r.estimatedSoloPaisa)}
              </p>
            </div>
            <Button disabled={accept.isPending} onClick={() => accept.mutate(r.id)}>
              Accept
            </Button>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
```

`web/components/CurrentTripPanel.tsx` (Task 7 replaces this file):

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { DriverTrip } from '@/lib/types';
import { PageMessage } from './PageMessage';
import { StatusBadge } from './StatusBadge';

export function CurrentTripPanel() {
  const trip = useQuery({ queryKey: ['driver-trip'], queryFn: () => api<DriverTrip | null>('/driver/trip'), refetchInterval: 3000 });
  if (trip.isPending) return <PageMessage>Loading current trip…</PageMessage>;
  if (trip.isError) return <PageMessage>{trip.error.message}</PageMessage>;
  if (!trip.data) return null;
  const t = trip.data;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Current trip from {t.pickup.name}</CardTitle>
        <StatusBadge status={t.status} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Seats {t.seatsTaken}/{t.capacity}
          {t.passengers.length > 1 && ' · Pool'}
          {t.isSolo && ' · Solo'}
        </p>
        <ul className="divide-y">
          {t.passengers.map((p) => (
            <li key={p.requestId} className="flex items-center justify-between gap-2 py-2">
              <span>
                {p.passengerName} · {p.seats} seat{p.seats > 1 ? 's' : ''} → {p.dropoff.name}
              </span>
              <StatusBadge status={p.status} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

Replace `web/app/driver/page.tsx`:

```tsx
'use client';
import { CompatibleRequests } from '@/components/CompatibleRequests';
import { CurrentTripPanel } from '@/components/CurrentTripPanel';
import { DriverStatusCard } from '@/components/DriverStatusCard';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { useMe } from '@/lib/session';

function DriverHome() {
  const tesla = useMe().data?.tesla;
  if (!tesla) return <PageMessage>No Tesla is registered to this driver.</PageMessage>;
  return (
    <div className="space-y-4">
      <DriverStatusCard tesla={tesla} />
      <CurrentTripPanel />
      <CompatibleRequests online={tesla.isOnline} />
    </div>
  );
}

export default function DriverPage() {
  return (
    <RequireRole role="DRIVER">
      <DriverHome />
    </RequireRole>
  );
}
```

- [ ] **Step 6: Verify and merge**

Two browser profiles (or one normal + one private window). Nusrat requests Banani → Mohakhali; Rafiq requests Banani → Gulshan 1; Jashim sees both, accepts Nusrat, then Rafiq. Panel shows `Seats 2/3 · Pool`. Nusrat's card flips to "Jashim is heading to you in Bullet" and "Sharing with 1 other passenger" within 3 s.

```bash
git add web
git commit -m "feat(web): let jashim accept compatible requests and see bullet's seats"
git checkout master && git merge --no-ff --no-edit feature/tesla-pooling
git push origin master feature/tesla-pooling
```

---

### Task 7: Trip lifecycle, fare lock and cancellation (`feature/trip-lifecycle`)

**Files:**
- Create: `api/src/services/payments.ts` (cash only; Task 8 extends)
- Modify: `api/src/services/driver.ts` (append lifecycle), `api/src/routes/trips.ts`
- Test: `api/test/trip-lifecycle.test.ts`
- Create web: `web/components/TripActions.tsx`
- Replace web: `web/components/CurrentTripPanel.tsx`

**Interfaces:**
- Consumes: `canMoveTrip`, `canMoveRequest`, `calculateFare`, `recordEvent`, `getDriverTrip`.
- Produces: `arriveAtPickup`, `startTrip`, `dropOff`, `cancelTrip` (all `(driverId, tripId, …)` → driver trip view); `settlePayment(tx, ride, driverId)`.
- Endpoints: `POST /trips/:id/arrive`, `POST /trips/:id/start`, `POST /trips/:id/cancel`, `POST /trips/:id/requests/:requestId/drop-off`.

- [ ] **Step 1: Branch and write failing tests**

```bash
git checkout -b feature/trip-lifecycle master
```

`api/test/trip-lifecycle.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { goOnline, loginAs, poolNusratAndRafiq, requestRide, resetDb } from './helpers';

describe('trip lifecycle', () => {
  beforeEach(resetDb);

  it('locks Nusrat at ৳57 and Rafiq at ৳60 when the pooled trip starts', async () => {
    const { nusrat, rafiq, jashim, n, r, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    const started = await jashim.post(`/trips/${tripId}/start`).expect(200);
    expect(started.body.status).toBe('STARTED');

    const nRide = await nusrat.get(`/ride-requests/${n}`).expect(200);
    expect(nRide.body).toMatchObject({
      status: 'IN_PROGRESS',
      fare: { basePaisa: 3000, distanceChargePaisa: 4600, poolDiscountPaisa: 1900, finalFarePaisa: 5700 },
    });
    const rRide = await rafiq.get(`/ride-requests/${r}`).expect(200);
    expect(rRide.body.fare).toEqual({ basePaisa: 3000, distanceChargePaisa: 5000, poolDiscountPaisa: 2000, finalFarePaisa: 6000 });
  });

  it('charges the full ৳76 when Nusrat rides alone', async () => {
    const [nusrat, jashim] = await Promise.all([loginAs('nusrat'), loginAs('jashim')]);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali');
    const { body: trip } = await jashim.post(`/driver/requests/${n}/accept`).expect(200);
    await jashim.post(`/trips/${trip.id}/arrive`).expect(200);
    await jashim.post(`/trips/${trip.id}/start`).expect(200);
    expect((await nusrat.get(`/ride-requests/${n}`)).body.fare.finalFarePaisa).toBe(7600);
  });

  it('rejects invalid transitions with 409', async () => {
    const { jashim, n, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/start`).expect(409); // not arrived yet
    await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(409); // not started
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/arrive`).expect(409); // twice
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    await jashim.post(`/trips/${tripId}/cancel`).expect(409); // underway
  });

  it('lets Nusrat cancel before Jashim arrives, freeing her seat for others', async () => {
    const { nusrat, jashim, n, tripId } = await poolNusratAndRafiq();
    await nusrat.post(`/ride-requests/${n}/cancel`).expect(200);
    const trip = await jashim.get('/driver/trip').expect(200);
    expect(trip.body).toMatchObject({ id: tripId, status: 'ACCEPTED', seatsTaken: 1 });
    expect(trip.body.passengers.map((p: { passengerName: string }) => p.passengerName)).toEqual(['Rafiq']);
  });

  it('refuses cancellation once Jashim has arrived', async () => {
    const { nusrat, jashim, n, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await nusrat.post(`/ride-requests/${n}/cancel`).expect(409);
  });

  it('cancels the Trip when its last passenger cancels', async () => {
    const [nusrat, jashim] = await Promise.all([loginAs('nusrat'), loginAs('jashim')]);
    const n = await requestRide(nusrat, 'Banani', 'Mohakhali');
    const { body: trip } = await jashim.post(`/driver/requests/${n}/accept`).expect(200);
    await nusrat.post(`/ride-requests/${n}/cancel`).expect(200);
    expect((await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } })).status).toBe('CANCELLED');
    expect((await jashim.get('/driver/trip')).text).toBe('null');
  });

  it('requeues Nusrat and Rafiq when Jashim cancels, so Kamal can pick them up', async () => {
    const { jashim, n, r, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/cancel`).expect(200);
    const statuses = await prisma.rideRequest.findMany({ where: { id: { in: [n, r] } }, select: { status: true, tripId: true } });
    expect(statuses).toEqual([
      { status: 'REQUESTED', tripId: null },
      { status: 'REQUESTED', tripId: null },
    ]);
    const kamal = await loginAs('kamal');
    await goOnline(kamal, 'Banani');
    expect((await kamal.get('/driver/requests').expect(200)).body).toHaveLength(2);
  });

  it('completes the Trip after the last drop-off and parks Bullet at the last destination', async () => {
    const { jashim, n, r, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    const afterNusrat = await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(200);
    expect(afterNusrat.body.status).toBe('STARTED');
    await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(409); // twice
    const done = await jashim.post(`/trips/${tripId}/requests/${r}/drop-off`).expect(200);
    expect(done.body.status).toBe('COMPLETED');
    const me = await jashim.get('/auth/me').expect(200);
    const gulshan1 = await prisma.zone.findUniqueOrThrow({ where: { name: 'Gulshan 1' } });
    expect(me.body.tesla.currentZoneId).toBe(gulshan1.id);
  });

  it("stops Kamal from touching Jashim's trip", async () => {
    const { tripId } = await poolNusratAndRafiq();
    const kamal = await loginAs('kamal');
    await kamal.post(`/trips/${tripId}/arrive`).expect(404);
    await kamal.get(`/trips/${tripId}`).expect(404);
  });
});
```

Run: `npm test -- trip-lifecycle`. Expected: FAIL (routes missing).

- [ ] **Step 2: Write `api/src/services/payments.ts`**

```ts
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
```

- [ ] **Step 3: Append lifecycle to `api/src/services/driver.ts`**

Update imports:

```ts
import type { EventType, Prisma, TripStatus } from '@prisma/client';
import { calculateFare } from '../domain/fare';
import { canMoveRequest, canMoveTrip } from '../domain/transitions';
import { settlePayment } from './payments';
```

Append:

```ts
async function moveTrip(
  tx: Prisma.TransactionClient,
  driverId: string,
  tripId: string,
  to: TripStatus,
  event: EventType,
  data: Prisma.TripUpdateManyMutationInput = {},
) {
  const trip = await tx.trip.findFirst({ where: { id: tripId, driverId } });
  if (!trip) throw notFound('Trip not found');
  if (!canMoveTrip(trip.status, to)) throw conflict(`Trip is ${trip.status}; it cannot move to ${to}`);
  const moved = await tx.trip.updateMany({ where: { id: tripId, status: trip.status }, data: { ...data, status: to } });
  if (moved.count === 0) throw conflict('Trip changed while you were acting; refresh and try again');
  await recordEvent(tx, { type: event, tripId, actorUserId: driverId, fromStatus: trip.status, toStatus: to });
  return trip;
}

export async function arriveAtPickup(driverId: string, tripId: string) {
  await prisma.$transaction((tx) => moveTrip(tx, driverId, tripId, 'DRIVER_ARRIVED', 'DRIVER_ARRIVED', { arrivedAt: new Date() }));
  return getDriverTrip(driverId, tripId);
}

/** Locks every Final Fare. Pool membership cannot change after DRIVER_ARRIVED, so the count is stable. */
export async function startTrip(driverId: string, tripId: string) {
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await moveTrip(tx, driverId, tripId, 'STARTED', 'STARTED', { startedAt: now });
    const riders = await tx.rideRequest.findMany({ where: { tripId, status: 'MATCHED' } });
    const pooled = riders.length >= 2;
    for (const r of riders) {
      const fare = calculateFare({ distanceM: r.distanceM, seats: r.seats, pooled });
      await tx.rideRequest.update({
        where: { id: r.id },
        data: {
          status: 'IN_PROGRESS',
          startedAt: now,
          baseFarePaisa: fare.basePaisa,
          distanceChargePaisa: fare.distanceChargePaisa,
          poolDiscountPaisa: fare.poolDiscountPaisa,
          finalFarePaisa: fare.totalPaisa,
        },
      });
      await recordEvent(tx, {
        type: 'FARE_LOCKED',
        tripId,
        rideRequestId: r.id,
        actorUserId: driverId,
        fromStatus: 'MATCHED',
        toStatus: 'IN_PROGRESS',
        detail: { ...fare, pooled, passengersOnTrip: riders.length },
      });
    }
  });
  return getDriverTrip(driverId, tripId);
}

export async function dropOff(driverId: string, tripId: string, requestId: string) {
  await prisma.$transaction(async (tx) => {
    // Serialise drop-offs on one Trip so exactly one of two concurrent last drop-offs completes it.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM trips WHERE id = ${tripId}::uuid AND driver_id = ${driverId}::uuid FOR UPDATE`;
    if (locked.length === 0) throw notFound('Trip not found');
    const trip = await tx.trip.findUniqueOrThrow({ where: { id: tripId } });
    if (trip.status !== 'STARTED') throw conflict(`Trip is ${trip.status}; start it before dropping anyone off`);

    const ride = await tx.rideRequest.findFirst({ where: { id: requestId, tripId } });
    if (!ride) throw notFound('Passenger is not on this trip');
    if (!canMoveRequest(ride.status, 'COMPLETED')) throw conflict(`This ride is ${ride.status}; it cannot be completed`);

    const now = new Date();
    await tx.rideRequest.update({ where: { id: requestId }, data: { status: 'COMPLETED', completedAt: now, paidAt: now } });
    await recordEvent(tx, { type: 'DROPPED_OFF', tripId, rideRequestId: requestId, actorUserId: driverId, fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED' });
    await settlePayment(tx, ride, driverId);
    await tx.tesla.update({ where: { driverId }, data: { currentZoneId: ride.dropoffZoneId } });

    const stillRiding = await tx.rideRequest.count({ where: { tripId, status: 'IN_PROGRESS' } });
    if (stillRiding === 0) await moveTrip(tx, driverId, tripId, 'COMPLETED', 'TRIP_COMPLETED', { completedAt: now });
  });
  return getDriverTrip(driverId, tripId);
}

/** Before STARTED only. Passengers go back to the queue (Requeue) instead of being cancelled. */
export async function cancelTrip(driverId: string, tripId: string) {
  await prisma.$transaction(async (tx) => {
    await moveTrip(tx, driverId, tripId, 'CANCELLED', 'CANCELLED', { cancelledAt: new Date() });
    const riders = await tx.rideRequest.findMany({ where: { tripId, status: 'MATCHED' } });
    await tx.rideRequest.updateMany({ where: { tripId, status: 'MATCHED' }, data: { status: 'REQUESTED', tripId: null, matchedAt: null } });
    for (const r of riders) {
      await recordEvent(tx, { type: 'REQUEUED', tripId, rideRequestId: r.id, actorUserId: driverId, fromStatus: 'MATCHED', toStatus: 'REQUESTED' });
    }
  });
  return getDriverTrip(driverId, tripId);
}
```

- [ ] **Step 4: Add routes to `api/src/routes/trips.ts`**

```ts
import { arriveAtPickup, cancelTrip, dropOff, getDriverTrip, listDriverTrips, startTrip } from '../services/driver';

const tripId = (value: string) => idParam(value, 'Trip not found');

tripsRouter.post('/:id/arrive', async (req, res) => {
  res.json(await arriveAtPickup(req.user!.id, tripId(req.params.id)));
});

tripsRouter.post('/:id/start', async (req, res) => {
  res.json(await startTrip(req.user!.id, tripId(req.params.id)));
});

tripsRouter.post('/:id/cancel', async (req, res) => {
  res.json(await cancelTrip(req.user!.id, tripId(req.params.id)));
});

tripsRouter.post('/:id/requests/:requestId/drop-off', async (req, res) => {
  res.json(await dropOff(req.user!.id, tripId(req.params.id), idParam(req.params.requestId, 'Passenger is not on this trip')));
});
```

Run: `npm test`. Expected: all PASS.

- [ ] **Step 5: Commit API**

```bash
git add api/test/trip-lifecycle.test.ts
git commit -m "test(trip): cover fare lock, invalid transitions and cancellation rules"
git add api/src
git commit -m "feat(trip): add arrive, start with fare lock, per-passenger drop-off and requeue"
```

- [ ] **Step 6: Write web**

`web/components/TripActions.tsx`:

```tsx
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { DriverTrip } from '@/lib/types';

function useTripAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api<DriverTrip>(path, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-trip'] });
      qc.invalidateQueries({ queryKey: ['driver-requests'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function TripActions({ trip }: { trip: DriverTrip }) {
  const act = useTripAction();
  const base = `/trips/${trip.id}`;
  const cancellable = trip.status === 'ACCEPTED' || trip.status === 'DRIVER_ARRIVED';
  return (
    <div className="flex flex-wrap gap-2">
      {trip.status === 'ACCEPTED' && (
        <Button disabled={act.isPending} onClick={() => act.mutate(`${base}/arrive`)}>
          Arrived at pickup
        </Button>
      )}
      {trip.status === 'DRIVER_ARRIVED' && (
        <Button disabled={act.isPending} onClick={() => act.mutate(`${base}/start`)}>
          Start trip
        </Button>
      )}
      {cancellable && (
        <Button
          variant="destructive"
          disabled={act.isPending}
          onClick={() => {
            if (confirm('Cancel this trip? Your passengers go back to the queue.')) act.mutate(`${base}/cancel`);
          }}
        >
          Cancel trip
        </Button>
      )}
    </div>
  );
}

export function DropOffButton({ tripId, requestId, name }: { tripId: string; requestId: string; name: string }) {
  const act = useTripAction();
  return (
    <Button size="sm" disabled={act.isPending} onClick={() => act.mutate(`/trips/${tripId}/requests/${requestId}/drop-off`)}>
      Drop off {name}
    </Button>
  );
}
```

Replace `web/components/CurrentTripPanel.tsx`:

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, taka } from '@/lib/api';
import type { DriverTrip } from '@/lib/types';
import { PageMessage } from './PageMessage';
import { StatusBadge } from './StatusBadge';
import { DropOffButton, TripActions } from './TripActions';

export function CurrentTripPanel() {
  const trip = useQuery({ queryKey: ['driver-trip'], queryFn: () => api<DriverTrip | null>('/driver/trip'), refetchInterval: 3000 });
  if (trip.isPending) return <PageMessage>Loading current trip…</PageMessage>;
  if (trip.isError) return <PageMessage>{trip.error.message}</PageMessage>;
  if (!trip.data) return null;
  const t = trip.data;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Current trip from {t.pickup.name}</CardTitle>
        <StatusBadge status={t.status} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Seats {t.seatsTaken}/{t.capacity}
          {t.passengers.length > 1 && ' · Pool'}
          {t.isSolo && ' · Solo'}
        </p>
        <TripActions trip={t} />
        <ul className="divide-y">
          {t.passengers.map((p) => (
            <li key={p.requestId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {p.passengerName} · {p.seats} seat{p.seats > 1 ? 's' : ''} → {p.dropoff.name}
                {p.finalFarePaisa !== null && ` · ${taka(p.finalFarePaisa)} ${p.paymentMethod === 'TESLAPAY' ? 'TeslaPay' : 'cash'}`}
              </span>
              {t.status === 'STARTED' && p.status === 'IN_PROGRESS' ? (
                <DropOffButton tripId={t.id} requestId={p.requestId} name={p.passengerName} />
              ) : (
                <StatusBadge status={p.status} />
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: Verify and merge**

Full story in two windows: accept Nusrat + Rafiq → Arrived → Start. Jashim's panel shows `Nusrat … ৳57 cash`, `Rafiq … ৳60 cash`. Nusrat's card shows the receipt with a −৳19 pool discount. Drop off Nusrat, then Rafiq. The panel disappears and Bullet's zone becomes Gulshan 1. Also check: Nusrat's Cancel button disappears once Jashim taps "Arrived".

```bash
git add web
git commit -m "feat(web): add trip actions and per-passenger drop-off for drivers"
git checkout master && git merge --no-ff --no-edit feature/trip-lifecycle
git push origin master feature/trip-lifecycle
```

---

### Task 8: TeslaPay (`feature/teslapay`) — cut third if behind

**Files:**
- Modify: `api/src/services/payments.ts`, `api/src/services/passenger.ts` (`createRideRequest`), `api/src/routes/auth.ts` (welcome credit)
- Test: `api/test/teslapay.test.ts`
- Modify web: `web/components/RideRequestForm.tsx` (payment select), `web/components/ActiveRideCard.tsx` (refresh balance)

**Interfaces:**
- Produces: `settlePayment` now charges TeslaPay with a ledger row; `WELCOME_CREDIT_PAISA` (`routes/auth.ts`).

- [ ] **Step 1: Branch and write failing tests**

```bash
git checkout -b feature/teslapay master
```

`api/test/teslapay.test.ts`:

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { STARTING_BALANCE_PAISA } from '../prisma/seed-data';
import { prisma } from '../src/db';
import { app, loginAs, poolNusratAndRafiq, resetDb, zoneId } from './helpers';

describe('TeslaPay', () => {
  beforeEach(resetDb);

  it("charges Nusrat's ৳57 at drop-off and writes one ledger row", async () => {
    const { nusrat, jashim, n, tripId } = await poolNusratAndRafiq({ paymentMethod: 'TESLAPAY' });
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    await jashim.post(`/trips/${tripId}/requests/${n}/drop-off`).expect(200);

    const me = await nusrat.get('/auth/me').expect(200);
    expect(me.body.teslapayBalancePaisa).toBe(STARTING_BALANCE_PAISA - 5700);
    const ledger = await prisma.teslapayTransaction.findMany({ where: { rideRequestId: n } });
    expect(ledger).toEqual([expect.objectContaining({ type: 'RIDE_CHARGE', amountPaisa: -5700, balanceAfterPaisa: STARTING_BALANCE_PAISA - 5700 })]);
  });

  it('leaves cash riders untouched', async () => {
    const { rafiq, jashim, r, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);
    await jashim.post(`/trips/${tripId}/requests/${r}/drop-off`).expect(200);
    expect((await rafiq.get('/auth/me')).body.teslapayBalancePaisa).toBe(STARTING_BALANCE_PAISA);
  });

  it('refuses a TeslaPay request larger than the balance', async () => {
    const shirin = await loginAs('shirin');
    await prisma.user.update({ where: { email: 'shirin@teslapool.dev' }, data: { teslapayBalancePaisa: 1000 } });
    await shirin
      .post('/ride-requests')
      .send({ pickupZoneId: await zoneId('Banani'), dropoffZoneId: await zoneId('Uttara'), paymentMethod: 'TESLAPAY' })
      .expect(422);
  });

  it('gives Nabila a ৳500 welcome credit on signup', async () => {
    const res = await request(app).post('/auth/signup').send({ name: 'Nabila', email: 'nabila@teslapool.dev', password: 'nusrats-sister' }).expect(201);
    expect(res.body.teslapayBalancePaisa).toBe(50_000);
    expect(await prisma.teslapayTransaction.count({ where: { userId: res.body.id, type: 'TOP_UP' } })).toBe(1);
  });
});
```

Run: `npm test -- teslapay`. Expected: FAIL on the first, third and fourth tests.

- [ ] **Step 2: Replace `api/src/services/payments.ts`**

```ts
import type { PaymentMethod, Prisma, RideRequest } from '@prisma/client';
import { recordEvent } from './events';

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
      // The balance covered the solo estimate at request time (which is ≥ the final fare), and a Passenger
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
```

- [ ] **Step 3: Add the balance check in `createRideRequest`** (`api/src/services/passenger.ts`)

Insert as the first statement inside the `prisma.$transaction(async (tx) => {` callback:

```ts
    if (input.paymentMethod === 'TESLAPAY') {
      const passenger = await tx.user.findUniqueOrThrow({ where: { id: passengerId } });
      if (passenger.teslapayBalancePaisa < estimate.solo.totalPaisa) {
        throw unprocessable('Not enough TeslaPay balance for this ride; choose cash instead');
      }
    }
```

- [ ] **Step 4: Welcome credit in `api/src/routes/auth.ts`**

Add `export const WELCOME_CREDIT_PAISA = 50_000; // ৳500` and replace the `prisma.user.create(...)` call in `/signup` with:

```ts
  const user = await prisma
    .$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: body.name, email: body.email, passwordHash, role: 'PASSENGER', teslapayBalancePaisa: WELCOME_CREDIT_PAISA },
      });
      await tx.teslapayTransaction.create({
        data: { userId: created.id, type: 'TOP_UP', amountPaisa: WELCOME_CREDIT_PAISA, balanceAfterPaisa: WELCOME_CREDIT_PAISA },
      });
      return created;
    })
    .catch((err) => {
      throw isUniqueViolation(err) ? conflict('That email is already registered') : err;
    });
```

Run: `npm test`. Expected: all PASS.

- [ ] **Step 5: Web edits**

In `web/components/RideRequestForm.tsx`: add `import type { PaymentMethod } from '@/lib/types';` (merge into the existing type import), add state `const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');`, send it in the mutation body (`{ pickupZoneId, dropoffZoneId, seats, allowSharing, paymentMethod }`), invalidate `['me']` in `onSuccess`, and add this block after the "Allow sharing" checkbox:

```tsx
          <div className="space-y-1">
            <Label htmlFor="payment">Payment</Label>
            <select id="payment" className={selectClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              <option value="CASH">Cash</option>
              <option value="TESLAPAY">TeslaPay</option>
            </select>
          </div>
```

In `web/components/ActiveRideCard.tsx`, change the `useQuery` for the ride so the header balance refreshes once the ride is paid:

```tsx
  const ride = useQuery({
    queryKey: ['ride', rideId],
    queryFn: async () => {
      const r = await api<PassengerRide>(`/ride-requests/${rideId}`);
      if (r.paidAt) qc.invalidateQueries({ queryKey: ['me'] });
      return r;
    },
    refetchInterval: 3000,
  });
```

- [ ] **Step 6: Verify and merge**

Nusrat pays with TeslaPay. After drop-off, her header balance drops by ৳57 within 3 s.

```bash
git add api
git commit -m "feat(payment): charge teslapay at drop-off with a ledger row per charge"
git add web
git commit -m "feat(web): let passengers choose cash or teslapay"
git checkout master && git merge --no-ff --no-edit feature/teslapay
git push origin master feature/teslapay
```

---

### Task 9: Ride timeline (`feature/ride-timeline`)

**Files:**
- Modify: `api/src/services/views.ts` (`eventView`), `api/src/services/passenger.ts` (`getPassengerRide`), `api/src/services/driver.ts` (`getDriverTrip`)
- Test: `api/test/timeline.test.ts`
- Create web: `web/components/Timeline.tsx`
- Modify web: `web/app/rides/[id]/page.tsx`, `web/app/driver/trips/[id]/page.tsx`

**Interfaces:**
- Produces: `eventView(event)`; `events: RideEvent[]` on `GET /ride-requests/:id` and `GET /trips/:id` (and on every response those functions build).

- [ ] **Step 1: Branch and write the failing test**

```bash
git checkout -b feature/ride-timeline master
```

`api/test/timeline.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { poolNusratAndRafiq, resetDb } from './helpers';

type Ev = { type: string; actorName: string | null; detail: Record<string, unknown> | null };

describe('ride timeline', () => {
  beforeEach(resetDb);

  it("shows Nusrat her own events and shared trip events, but nothing from Rafiq's ride", async () => {
    const { nusrat, rafiq, jashim, n, r, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    await jashim.post(`/trips/${tripId}/start`).expect(200);

    const mine: Ev[] = (await nusrat.get(`/ride-requests/${n}`).expect(200)).body.events;
    expect(mine.map((e) => e.type)).toEqual(['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'STARTED', 'FARE_LOCKED']);
    expect(mine.every((e) => e.actorName !== 'Rafiq')).toBe(true);
    expect(mine.at(-1)!.detail).toMatchObject({ totalPaisa: 5700, pooled: true, passengersOnTrip: 2 });

    const his: Ev[] = (await rafiq.get(`/ride-requests/${r}`).expect(200)).body.events;
    expect(his.map((e) => e.type)).toEqual(['REQUESTED', 'JOINED_POOL', 'DRIVER_ARRIVED', 'STARTED', 'FARE_LOCKED']);
  });

  it('shows Jashim the whole trip', async () => {
    const { jashim, tripId } = await poolNusratAndRafiq();
    await jashim.post(`/trips/${tripId}/arrive`).expect(200);
    const trip = await jashim.get(`/trips/${tripId}`).expect(200);
    expect(trip.body.events.map((e: Ev) => e.type)).toEqual(['ACCEPTED', 'JOINED_POOL', 'DRIVER_ARRIVED']);
  });
});
```

Run: `npm test -- timeline`. Expected: FAIL (`events` undefined).

- [ ] **Step 2: Append `eventView` to `api/src/services/views.ts`**

```ts
export const eventInclude = { actor: { select: { name: true } } } satisfies Prisma.RideEventInclude;

export function eventView(e: Prisma.RideEventGetPayload<{ include: typeof eventInclude }>) {
  return {
    id: e.id,
    type: e.type,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    detail: e.detail,
    actorName: e.actor?.name ?? null,
    createdAt: e.createdAt,
  };
}
```

- [ ] **Step 3: Return events from `getPassengerRide`**

Add `eventInclude, eventView` to the `./views` import in `passenger.ts` and replace `getPassengerRide` with:

```ts
export async function getPassengerRide(passengerId: string, id: string) {
  const ride = await prisma.rideRequest.findFirst({ where: { id, passengerId }, include: rideInclude });
  if (!ride) throw notFound('Ride not found');
  const [coRiders, events] = await Promise.all([
    ride.tripId
      ? prisma.rideRequest.count({ where: { tripId: ride.tripId, id: { not: id }, status: { in: ['MATCHED', 'IN_PROGRESS', 'COMPLETED'] } } })
      : null,
    // Own ride's events plus trip-wide events (arrive, start, complete). Never another passenger's events.
    prisma.rideEvent.findMany({
      where: { OR: [{ rideRequestId: id }, ...(ride.tripId ? [{ tripId: ride.tripId, rideRequestId: null }] : [])] },
      include: eventInclude,
      orderBy: { id: 'asc' },
    }),
  ]);
  return { ...passengerRideView(ride, coRiders), events: events.map(eventView) };
}
```

- [ ] **Step 4: Return events from `getDriverTrip`**

Add `eventInclude, eventView` to the `./views` import in `driver.ts` and replace `getDriverTrip` with:

```ts
export async function getDriverTrip(driverId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, driverId }, include: tripInclude });
  if (!trip) throw notFound('Trip not found');
  const events = await prisma.rideEvent.findMany({ where: { tripId }, include: eventInclude, orderBy: { id: 'asc' } });
  return { ...driverTripView(trip), events: events.map(eventView) };
}
```

Run: `npm test`. Expected: all PASS.

- [ ] **Step 5: Commit API**

```bash
git add api
git commit -m "feat(timeline): expose per-passenger and per-trip ride events"
```

- [ ] **Step 6: Write `web/components/Timeline.tsx`**

```tsx
import { taka } from '@/lib/api';
import type { RideEvent } from '@/lib/types';

const LABELS: Record<string, string> = {
  REQUESTED: 'Ride requested',
  ACCEPTED: 'Driver accepted',
  JOINED_POOL: 'Joined a shared Tesla',
  DRIVER_ARRIVED: 'Driver arrived at pickup',
  STARTED: 'Trip started',
  FARE_LOCKED: 'Fare locked',
  DROPPED_OFF: 'Dropped off',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  REQUEUED: 'Driver cancelled; back in the queue',
  TRIP_COMPLETED: 'Trip completed',
};

function describe(e: RideEvent): string | null {
  const d = e.detail ?? {};
  const paisa = (key: string) => taka(Number(d[key]));
  switch (e.type) {
    case 'REQUESTED':
      return d.estimatedSoloPaisa ? `Estimated ${paisa('estimatedSoloPaisa')} solo, ${paisa('estimatedPooledPaisa')} if pooled` : null;
    case 'ACCEPTED':
    case 'JOINED_POOL':
      return `Seats ${d.seatsTaken}/${d.capacity}`;
    case 'FARE_LOCKED':
      return d.pooled
        ? `${paisa('totalPaisa')}: ${paisa('subtotalPaisa')} minus ${paisa('poolDiscountPaisa')} pool discount (${Number(d.passengersOnTrip)} riders)`
        : `${paisa('totalPaisa')} (rode alone)`;
    case 'PAID':
      return `${paisa('amountPaisa')} by ${d.method === 'TESLAPAY' ? 'TeslaPay' : 'cash'}${d.fellBackToCash ? ' (TeslaPay fell back to cash)' : ''}`;
    case 'CANCELLED':
      return d.seatsFreed ? `${d.seatsFreed} seat(s) freed` : typeof d.reason === 'string' ? d.reason : null;
    default:
      return null;
  }
}

export function Timeline({ events }: { events: RideEvent[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No events yet.</p>;
  return (
    <ol className="space-y-4 border-l pl-5">
      {events.map((e) => {
        const note = describe(e);
        return (
          <li key={e.id} className="relative text-sm">
            <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            <p className="font-medium">{LABELS[e.type] ?? e.type}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {e.actorName && ` · ${e.actorName}`}
              {e.fromStatus && e.toStatus && ` · ${e.fromStatus} → ${e.toStatus}`}
            </p>
            {note && <p className="text-muted-foreground">{note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 7: Show the timeline on both detail pages**

In `web/app/rides/[id]/page.tsx` and `web/app/driver/trips/[id]/page.tsx`, add the imports `import { Timeline } from '@/components/Timeline';` (and `Card, CardContent, CardHeader, CardTitle` where missing), then add as the last child of the outer `<div className="space-y-4">`:

```tsx
      <Card>
        <CardHeader>
          <CardTitle>What happened</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline events={r.events ?? []} />
        </CardContent>
      </Card>
```

(Use `t.events` on the driver page.)

- [ ] **Step 8: Verify and merge**

Open Nusrat's seeded ride from yesterday: the timeline reads Requested 08:41 → Driver accepted → Driver arrived → Trip started → Fare locked "৳57: ৳76 minus ৳19 pool discount (2 riders)" → Dropped off → Paid ৳57 by TeslaPay. Jashim's trip page shows both passengers' events.

```bash
git add web
git commit -m "feat(web): show the ride timeline on ride and trip pages"
git checkout master && git merge --no-ff --no-edit feature/ride-timeline
git push origin master feature/ride-timeline
```

---

### Task 10: Pre-release, deploy and release (`pre-release` → `release/v1.0.0`)

**Files:**
- Create: `README.md` (full), `api/scripts/rush-hour.ts` (optional), screenshots under `docs/screenshots/`
- Modify: whatever deployment reveals

- [ ] **Step 1: Cut `pre-release`**

```bash
git checkout -b pre-release master
git push -u origin pre-release
```

All remaining work in this task is committed on `pre-release`.

- [ ] **Step 2: Clean-clone check**

```bash
cd /tmp && rm -rf dtp-check && git clone <repo-url> dtp-check && cd dtp-check
docker compose up --build
```

Expected: `db`, `api` and `web` start with no `.env`; `http://localhost:3000` shows the demo buttons; Nusrat's history has yesterday's ride. Then `docker compose down -v`. Fix anything that breaks as `fix(docker): …` commits.

- [ ] **Step 3: Deploy the database (Neon, free)**

Create a Neon project in region `ap-southeast-1` (Singapore, the closest to Dhaka). Copy the **direct** (non-pooled) connection string, which ends with `?sslmode=require`. Prisma migrations need a direct connection.

- [ ] **Step 4: Deploy the API (Render, free web service)**

New Web Service from the GitHub repo. Settings: root directory `api`, runtime Docker, instance type Free, health check path `/health`, branch `release/v1.0.0` (switch to it after Step 9; use `pre-release` until then). Environment:

| Key | Value |
|---|---|
| `DATABASE_URL` | Neon direct connection string |
| `JWT_SECRET` | output of `openssl rand -base64 48` |
| `COOKIE_SECURE` | `true` |

Render sets `PORT` itself. Expected: the deploy log shows the migration applied, `Seeded the Banani rush-hour cast`, and `https://<name>.onrender.com/health` returns `{"status":"ok"}`.

- [ ] **Step 5: Deploy the web app (Vercel, free Hobby)**

Import the repo. Root directory `web`. Environment: `API_URL=https://<name>.onrender.com`, `NEXT_PUBLIC_DEMO_MODE=true`. Production branch: same as Render. Expected: login as Nusrat works on the Vercel URL (proves the cookie survives the rewrite proxy). Accept that the first request after 15 idle minutes waits ~50 s while Render wakes, and note it in the README.

- [ ] **Step 6 (optional, cut first): `api/scripts/rush-hour.ts`**

```ts
/**
 * Re-enacts 8:41 AM in Banani against a running API:
 * Rafiq books 2 seats, then Nusrat and Shirin race for Bullet's last seat.
 * Usage: API_URL=http://localhost:4000 npm run demo:rush-hour  (needs no active rides for the cast)
 */
import { CAST, DEMO_PASSWORD } from '../prisma/seed-data';

const API = process.env.API_URL ?? 'http://localhost:4000';

async function login(who: keyof typeof CAST) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: CAST[who].email, password: DEMO_PASSWORD }),
  });
  if (!res.ok) throw new Error(`${who} could not sign in: ${res.status}`);
  const cookie = res.headers.get('set-cookie')!.split(';')[0];
  return async (path: string, body?: unknown) => {
    const r = await fetch(`${API}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
}

async function main() {
  const [rafiq, nusrat, shirin, jashimPhone, jashimTablet] = await Promise.all([
    login('rafiq'),
    login('nusrat'),
    login('shirin'),
    login('jashim'),
    login('jashim'),
  ]);
  const zones: { id: number; name: string }[] = (await rafiq('/zones')).body;
  const id = (name: string) => zones.find((z) => z.name === name)!.id;

  const r = await rafiq('/ride-requests', { pickupZoneId: id('Banani'), dropoffZoneId: id('Gulshan 1'), seats: 2 });
  console.log('8:41 Rafiq books 2 seats to Gulshan 1:', r.status);
  const accepted = await jashimPhone(`/driver/requests/${r.body.id}/accept`, {});
  console.log('8:42 Jashim accepts. Bullet seats:', `${accepted.body.seatsTaken}/${accepted.body.capacity}`);

  const n = await nusrat('/ride-requests', { pickupZoneId: id('Banani'), dropoffZoneId: id('Mohakhali') });
  const s = await shirin('/ride-requests', { pickupZoneId: id('Banani'), dropoffZoneId: id('Gulshan 2') });
  console.log('8:43 Nusrat and Shirin both want the last seat. Jashim taps Accept on two devices at once…');

  const [a, b] = await Promise.all([
    jashimPhone(`/driver/requests/${n.body.id}/accept`, {}),
    jashimTablet(`/driver/requests/${s.body.id}/accept`, {}),
  ]);
  console.log('  Nusrat accept:', a.status, a.body?.error ?? 'seated');
  console.log('  Shirin accept:', b.status, b.body?.error ?? 'seated');
  const trip = (await jashimPhone('/driver/trip')).body;
  console.log(`Bullet ends at ${trip.seatsTaken}/${trip.capacity}. Never more.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Commit: `chore(demo): add rush-hour script that replays the last-seat race`.

- [ ] **Step 7: Write the README**

Sections, in this order (PRD §12):

1. Title, tagline, **demo video link**, **live URLs** (web, API `/health`), and a note about the Render cold start.
2. Summary and problem statement, in your own words (the Banani story in 3 sentences).
3. Features implemented (passenger / driver / pool), with 3–4 screenshots from `docs/screenshots/` (request form with estimate, pooled active ride, Jashim's panel at 3/3, timeline).
4. Architecture diagram and ERD (Mermaid below), plus both state machines.
5. Tech stack and justification table: for every non-mandated choice (Express, Postgres, Prisma, zod, JWT cookie + bcrypt, Tailwind/shadcn, TanStack Query polling, Vitest + supertest on a real DB, Neon/Render/Vercel) give what was picked, the realistic alternatives, why it fits a ride-pooling MVP, and what would make you switch.
6. Project structure (the tree from this plan, trimmed).
7. Prerequisites (Docker, Node 22), environment variables table (from `.env.example`), local setup, `docker compose up`, migrations/seed, running tests (`docker compose up -d db && cd api && npm test`).
8. Demo credentials: all five cast emails, password `bullet-3-seats`, and a note that demo buttons exist on `/login`.
9. API overview table (every endpoint from Tasks 2–9 with role and purpose).
10. Domain rules, stated so an evaluator can check them by hand:
    - **Matching rule**: the Compatible definition from `CONTEXT.md`, worked for Nusrat and Rafiq: same pickup Banani; Mohakhali ↔ Gulshan 1 are 1.2 km apart, under 3 km.
    - **Fare model**: the formula, a worked table for Nusrat (2.3 km: 3000 + 4600 = 7600 → −1900 = **5700 paisa**) and Rafiq (2.5 km: 3000 + 5000 = 8000 → −2000 = **6000 paisa**), when the fare locks (at `STARTED`), and **why integer paisa** (exact arithmetic, no float drift, all components divisible by construction, matches how BDT is actually counted).
    - **Cancellation rules**: a Passenger may cancel while Requested, or Matched before the Driver arrives; their seat is freed; the last cancellation cancels the Trip; a Driver may cancel before Started and every Passenger on it is Requeued; no cancellation fees.
11. **Concurrency** section: the Nusrat/Shirin scenario, the atomic conditional `UPDATE` (link ADR 0001), the `CHECK` constraint as a second net, partial unique indexes, the drop-off `FOR UPDATE`, which tests prove it, and at scale: per-Trip row contention stays local; move matching to a queue per zone only if accept latency suffers.
12. Key decisions and trade-offs (polling vs WebSockets, driver-driven matching vs auto-assign, fare lock at start, zones vs real maps, raw SQL in one place, capacity snapshot on `trips`).
13. Assumptions (drivers are seeded, one active ride per passenger, pickup Zone = current Zone of the driver, co-riders shown as a count only, no ride expiry, no cancellation fees, no top-ups).
14. Known limitations and next improvements (stale requests never expire; no push notifications; rate limiter keyed behind two proxies; no refunds; zone centroids only).
15. **If Oi Tesla goes viral** (bullets + one Mermaid diagram): stateless API behind a load balancer and horizontal scaling; Postgres primary + read replicas for history, PostGIS/geohash for nearby drivers instead of Zones; Redis for driver locations and hot reads; matching per geo-cell through a queue with idempotent consumers; WebSockets/SSE for live status; idempotency keys on `POST /ride-requests` and accept; per-user and per-IP rate limits at the gateway; OpenTelemetry traces, RED metrics and alerting; partitioning `ride_events` by month; retries with backoff and a dead-letter queue; blue/green deploys with backward-compatible migrations.
16. **AI Usage**: tools used (Claude Code for design grilling, glossary, ADR and plan; also whatever you use while building), one accepted suggestion (e.g. the atomic conditional `UPDATE` for the seat claim), one rejected or changed suggestion and why. **Write this section yourself, in your own words.**

Mermaid blocks to paste:

```mermaid
flowchart LR
  B[Browser] -->|HTTPS| W["Next.js on Vercel<br/>pages + /api/* rewrite proxy"]
  W -->|"/api/* (same-origin cookie)"| A["Express 5 API on Render<br/>auth · zod validation · services"]
  A -->|"Prisma + one atomic seat-claim UPDATE"| D[("PostgreSQL on Neon")]
```

```mermaid
erDiagram
  users ||--o| teslas : drives
  users ||--o{ ride_requests : books
  users ||--o{ trips : drives
  users ||--o{ teslapay_transactions : owns
  zones ||--o{ ride_requests : "pickup / dropoff"
  zones ||--o{ trips : "pickup"
  zones ||--o{ teslas : "current zone"
  teslas ||--o{ trips : runs
  trips ||--o{ ride_requests : carries
  trips ||--o{ ride_events : logs
  ride_requests ||--o{ ride_events : logs
  ride_requests ||--o{ teslapay_transactions : "paid by"

  users { uuid id PK
    enum role
    text email UK
    int teslapay_balance_paisa "CHECK >= 0" }
  teslas { uuid id PK
    uuid driver_id FK,UK
    int capacity "CHECK 1..6"
    bool is_online }
  trips { uuid id PK
    uuid driver_id FK "UNIQUE while active"
    enum status
    int capacity "snapshot"
    int seats_taken "CHECK <= capacity"
    bool is_solo }
  ride_requests { uuid id PK
    uuid passenger_id FK "UNIQUE while active"
    uuid trip_id FK
    int seats "CHECK 1..3"
    enum status
    int final_fare_paisa }
  ride_events { int id PK
    enum type
    text from_status
    text to_status
    jsonb detail }
  teslapay_transactions { uuid id PK
    int amount_paisa
    int balance_after_paisa }
  zones { int id PK
    text name UK
    float lat
    float lng }
```

```mermaid
stateDiagram-v2
  direction LR
  state "Trip" as T {
    [*] --> ACCEPTED: first Accept
    ACCEPTED --> DRIVER_ARRIVED
    DRIVER_ARRIVED --> STARTED: fares lock
    STARTED --> COMPLETED: last drop-off
    ACCEPTED --> CANCELLED: driver cancels / last passenger cancels
    DRIVER_ARRIVED --> CANCELLED: driver cancels
  }
```

```mermaid
stateDiagram-v2
  direction LR
  state "Ride Request" as R {
    [*] --> REQUESTED
    REQUESTED --> MATCHED: Accept
    MATCHED --> REQUESTED: Requeue (driver cancels)
    MATCHED --> IN_PROGRESS: trip starts
    IN_PROGRESS --> COMPLETED: drop-off
    REQUESTED --> CANCELLED: passenger
    MATCHED --> CANCELLED: passenger, before driver arrives
  }
```

Commit: `docs(readme): document architecture, fare model, concurrency and setup`, then `docs(readme): add viral-scale design and ai usage`.

- [ ] **Step 8: Record the video** (≤ 6 min, Loom): 0:00–1:00 problem in your words; 1:00–3:00 architecture diagram, ERD, both state machines, one decision (atomic seat claim), one trade-off (polling); 3:00–6:00 Nusrat + Rafiq pooled ride end to end in two windows, receipt and timeline, the race via `npm run demo:rush-hour` or the pooling test run, the deployed URL. Put the link at the top of the README: `docs(readme): link demo video`.

- [ ] **Step 9: Cut the release**

```bash
git checkout -b release/v1.0.0 pre-release
git tag -a v1.0.0 -m "Dhaka Tesla Pool MVP"
git push -u origin release/v1.0.0 --tags
git checkout master && git merge --no-ff --no-edit pre-release && git push origin master
```

Point Render and Vercel production at `release/v1.0.0` and confirm both redeploy green.

- [ ] **Step 10: Submission checklist** (PRD §14)

- [ ] Repo public; `master`, `pre-release`, `release/v1.0.0` exist; history shows feature branches merged with `--no-ff`
- [ ] `docker compose up` works on a clean clone; `.env.example` present; `git log -p | grep -i secret` shows nothing real
- [ ] Seed uses the cast; tests use the cast; README uses the cast
- [ ] Architecture diagram + ERD in README
- [ ] `npm test` green; the six PRD-mandated behaviours map to named tests (table below)
- [ ] Deployment URLs work; video link and AI Usage section present

---

## Self-Review: PRD Coverage

| PRD requirement | Where |
|---|---|
| Passenger sign up/in | Task 2 |
| Request ride with pickup, destination, seats; see estimated fare | Tasks 3, 4 |
| Status waiting → matched → in progress → completed/cancelled | Tasks 4, 6, 7 (`RequestStatus`) |
| History; cancel while valid | Tasks 4, 7 |
| Driver sign in, online/offline, owns a fixed-capacity Tesla | Tasks 1, 2, 5 |
| See relevant requests; accept ride/pool | Tasks 5, 6 |
| Mark arrival, start, complete | Task 7 (per-passenger drop-off completes the Trip) |
| See passengers/seats and ride history | Tasks 5, 6, 7 |
| Multiple requests share a Tesla; seats never exceed capacity | Task 6 + ADR 0001 + CHECK constraint |
| Individual fare per passenger | Task 7 (fare lock), receipts in Task 4 web |
| Clear lifecycle; obvious pool membership | `transitions.ts`, Pool badge, co-rider count |
| History to explain what happened | Task 9 Ride Events |
| Matching rule applied to Nusrat and Rafiq | `compatibility.ts` + tests |
| Fare model testable by hand; integer paisa | `fare.ts` + tests + README table |
| Cash or TeslaPay | Task 8 |
| Docker compose, migrations, seed, health checks | Task 1, 2 |
| Test: capacity never exceeded | `pooling.test.ts` › never seats more… / database rejects… |
| Test: invalid transitions rejected | `trip-lifecycle.test.ts` › rejects invalid transitions; `transitions.test.ts` |
| Test: Nusrat and Rafiq pooled fares | `fare.test.ts`, `trip-lifecycle.test.ts` › locks ৳57/৳60 |
| Test: cannot modify another user's ride | `ride-requests.test.ts` › hides Nusrat's ride; `trip-lifecycle.test.ts` › stops Kamal |
| Test: cancellation rules | `trip-lifecycle.test.ts` (4 tests), `ride-requests.test.ts` |
| Test: concurrent requests cannot corrupt capacity | `pooling.test.ts` › last seat race; two-driver race |
| Git workflow, commit format | Every task's final step; Task 10 release |
| README contents, video, AI usage, viral bonus | Task 10 |
