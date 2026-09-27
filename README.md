# Dhaka Tesla Pool

Share a seat. Split the fare. Survive Dhaka traffic.

**Live app:** https://dhaka-tesla-pool-ebon.vercel.app
**Live API health:** https://dhaka-tesla-pool-api-sgmc.onrender.com/health
**Demo video:** _TODO(author) — link the ≤6-minute walkthrough here._

> The API runs on a free instance that sleeps after 15 idle minutes. The first
> request after a nap waits roughly 50 seconds while it wakes; every request
> after that is fast.

## The problem

Nusrat, Rafiq and Shirin all travel from Banani towards Mohakhali and Gulshan 1
around 8:41 AM, but each books a separate three-wheeler, so three "Teslas" burn
fuel to carry one person each. Dhaka Tesla Pool lets a Driver put several Ride
Requests onto one Trip in a vehicle with fixed seats: passengers share the ride,
each pays their own fare, and a **Pool Discount** rewards the sharing. The hard
part is not the screens — it is never overbooking a seat when two passengers
accept at the same instant, and keeping every fare and status auditable.

## Features

**Passenger**

- Sign up (৳500 TeslaPay welcome credit), log in, log out.
- See the Estimated Fare for a Zone pair, shown solo and "if pooled", before booking.
- Request 1–3 seats, with or without sharing, paying cash or TeslaPay.
- Watch the live status: waiting → matched → in progress → completed.
- Cancel while the rules allow, with the seat freed immediately.
- Ride history, a per-ride receipt, and a Timeline of every Ride Event.
- A TeslaPay page: balance plus the full ledger.

**Driver**

- Log in, go online/offline, and set the current Zone.
- See only the Compatible Ride Requests in that Zone.
- Accept a request into the Trip, or open a new Trip with the first Accept.
- Arrive at pickup, start the Trip (locking every Final Fare), Drop-off each
  passenger, or cancel before the Trip starts.

**Pool**

- Several Ride Requests share one Tesla; seats can never exceed capacity.
- A Pool Discount of 25% when a Trip starts with two or more active requests.
- A Solo Request stays alone and pays full fare.

### Screenshots

| Request with the solo/pooled estimate | Active pooled ride |
| --- | --- |
| ![Fare estimate on the request form](docs/screenshots/01-request-estimate.png) | ![Pooled active ride](docs/screenshots/02-pooled-ride.png) |

| Driver panel with Bullet's seats | Ride timeline |
| --- | --- |
| ![Driver panel](docs/screenshots/03-driver-panel.png) | ![Ride timeline](docs/screenshots/04-timeline.png) |

## Architecture

```mermaid
flowchart LR
  B[Browser] -->|HTTPS| W["Next.js on Vercel<br/>pages + /api/* rewrite proxy"]
  W -->|"/api/* (same-origin cookie)"| A["Express 5 API on Render<br/>auth · zod validation · services"]
  A -->|"Prisma + one atomic seat-claim UPDATE"| D[("PostgreSQL on Neon")]
```

The web app is a thin client: every call goes to same-origin `/api/*` and Next.js
rewrites that to the API. The session cookie is therefore first-party and no CORS
configuration is needed. Inside the API, `src/domain` holds the pure rules,
`src/services` owns the transactions and the Ride Events, and only Prisma (plus
one documented raw statement, ADR 0001) touches Postgres. Status reaches the
browser by polling every 3 seconds.

### Data model

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

All money is integer **paisa** (100 paisa = ৳1); no floats.

### State machines

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

`STARTED → CANCELLED` is deliberately impossible: a Trip underway is finished by
dropping passengers off. `COMPLETED` and `CANCELLED` are terminal. The allowed
edges live in `api/src/domain/transitions.ts` and every mutation is guarded by
them, so an invalid transition is a `409`, not a silent write.

## Tech stack

| Choice | Realistic alternatives | Why it fits this MVP | What would make us switch |
| --- | --- | --- | --- |
| Node 22 + TypeScript | Go, Python/FastAPI | One language across web and API; types catch shape drift between the Prisma models, the services and the web pages | A CPU-bound matching service, or a team that already lives elsewhere |
| Express 5 | Fastify, NestJS | Smallest thing that mounts routers and middleware; the domain logic stays in plain functions, not decorators | A larger surface needing schema-first routing and built-in validation |
| PostgreSQL 16 | MySQL, SQLite | Partial unique indexes and `CHECK` constraints are what make the concurrency rules enforceable in the database itself; SQLite would lose them | Write volume beyond one primary, or an existing managed MySQL |
| Prisma 6 | Drizzle, Kysely, raw SQL | Typed models and migrations for the 7 tables, with one raw statement where the expressiveness is needed (ADR 0001) | Pinned at 6.x on purpose; 7.x changes the generator and requires driver adapters |
| zod | Joi, express-validator | One schema per request body/query, and the parse error already carries the field issues we return as 422 | Nothing soon |
| JWT in an httpOnly cookie + bcryptjs | Session table, Auth0/Clerk | No third-party dependency, no extra table, and the cookie survives the same-origin `/api/*` rewrite | Real driver document verification, SSO, or multi-device session revocation |
| Next.js App Router + Tailwind + shadcn/ui | Vite + React, Remix | The rewrite proxy keeps the cookie first-party; Tailwind/shadcn give accessible primitives without a design system to maintain | A native mobile client consuming the API directly |
| TanStack Query polling (3 s) | WebSockets, SSE, SWR | Ride state changes on the scale of seconds, so polling is honest about the freshness and costs nothing to operate | Sub-second updates, or polling load becoming a real cost |
| Vitest + supertest on a real Postgres | Jest, in-memory fakes | The rules we most need to prove live in the database (indexes, `CHECK`s, row locks), so tests run against real Postgres, not mocks | Slower suites needing per-test isolation via schemas |
| Docker Compose | Local installs | `docker compose up` brings db + api + web up with no `.env`, seeding the cast and health-checking each service | Kubernetes once it is not a one-box demo |
| Neon + Render + Vercel | Fly, Railway, Supabase | Free tiers for all three, HTTP-only, and the region is close to Dhaka (Neon in Singapore) | Cost model, or needing long-lived connections and background workers |

## Project structure

```
.
├── CONTEXT.md                     domain glossary
├── README.md
├── .env.example
├── docker-compose.yml
├── docker/postgres-init/01-test-db.sql
├── docs/
│   ├── adr/0001-atomic-seat-claim.md
│   ├── agents/                    skill configuration for the agent workflow
│   ├── implementation-plan.md
│   └── screenshots/
├── api/
│   ├── Dockerfile
│   ├── prisma/                    schema, migration, seed-data.ts, seed.ts
│   ├── scripts/rush-hour.ts       demo replay of the last-seat race
│   ├── src/
│   │   ├── server.ts  app.ts  config.ts  db.ts
│   │   ├── http/                  auth.ts, errors.ts
│   │   ├── domain/                geo.ts, fare.ts, compatibility.ts, transitions.ts
│   │   ├── services/              events, views, passenger, driver, payments
│   │   └── routes/                auth, catalog, passenger, driver, trips, teslapay
│   └── test/                      vitest suites (integration, real Postgres)
└── web/
    ├── Dockerfile  next.config.ts
    ├── lib/                       api.ts, types.ts, session.ts, demo.ts
    ├── components/                Header, RequireRole, StatusBadge, ZoneSelect,
    │                              FareReceipt, RideRequestForm, ActiveRideCard,
    │                              DriverStatusCard, CompatibleRequests,
    │                              CurrentTripPanel, TripActions, Timeline
    └── app/                       /, login, signup, ride, rides/[id], teslapay,
                                   driver, driver/trips/[id]
```

## Running it

**Prerequisites:** Docker (with Compose) for the easy path, or Node 22 + a local
PostgreSQL 16 for the manual path.

**Environment variables** (`.env.example`, copy to `.env` — never commit real secrets):

| Key | Purpose | Local default |
| --- | --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres credentials used by compose | `tesla` / `tesla` / `tesla_pool` |
| `DATABASE_URL` | Prisma connection string | `postgresql://tesla:tesla@localhost:5432/tesla_pool` |
| `JWT_SECRET` | Signs the session cookie, at least 32 characters | placeholder |
| `COOKIE_SECURE` | `true` behind HTTPS so the cookie is `Secure` | `false` |
| `PORT` | API port | `4000` |
| `NEXT_PUBLIC_DEMO_MODE` | Baked into the web bundle; `true` shows the demo sign-in buttons | `true` |
| `API_URL` | Build-time target of the web app's `/api/*` rewrite | `http://api:4000` in compose |

**Whole stack in one command** — no `.env` needed, compose defaults cover it:

```bash
docker compose up --build
# web on http://localhost:3000, api on http://localhost:4000, db on 5432
```

The API container runs `prisma migrate deploy`, then the idempotent seed, then the
server, so the demo cast and yesterday's pooled ride exist on first boot.

**Manual path:**

```bash
cp .env.example .env
docker compose up -d db
cd api
npm ci
npx prisma migrate deploy      # or `npm run db:migrate` while developing
npm run db:seed                # idempotent; prints "already seeded" on later runs
npm run dev                    # http://localhost:4000
```

```bash
cd web && npm ci && npm run dev   # http://localhost:3000, rewrite targets API_URL
```

**Tests** — they run against a real Postgres, so start the database first:

```bash
docker compose up -d db
cd api && npm test
```

`npm test` runs `prisma migrate deploy` against `tesla_pool_test` (created by
`docker/postgres-init/01-test-db.sql`) and then the Vitest suites. Override the
target with `TEST_DATABASE_URL` if you keep your test database elsewhere.

### Deployment

| Piece | Host | Settings |
| --- | --- | --- |
| Database | Neon (free), `aws-ap-southeast-1` (Singapore, closest to Dhaka) | Use the **direct** (non-pooled) connection string ending in `?sslmode=require`; Prisma migrations need a direct connection |
| API | Render (free web service) | Root directory `api`, runtime Docker, health check path `/health`, branch `release/v1.0.0`; env `DATABASE_URL`, `JWT_SECRET` (`openssl rand -base64 48`) and `COOKIE_SECURE=true`. The container runs `prisma migrate deploy`, then the idempotent seed, then the server, so the demo cast exists on first boot |
| Web | Vercel (Hobby) | Root directory `web`; build-time env `API_URL=https://dhaka-tesla-pool-api-sgmc.onrender.com` and `NEXT_PUBLIC_DEMO_MODE=true`. Both are read during `next build`, so the `/api/*` rewrite and the demo buttons are baked into the output |

`COOKIE_SECURE` must be `true` wherever the app is served over HTTPS; leave it
`false` for `http://localhost` so Safari keeps the cookie. `API_URL` is required
for a production build — `next.config.ts` throws if it is missing, which turns a
silently broken rewrite into a failed build.

## Demo credentials

Every seeded account shares the password **`bullet-3-seats`**. The `/login` page
also shows one-click buttons for each of them when `NEXT_PUBLIC_DEMO_MODE=true`.

| Email | Name | Role |
| --- | --- | --- |
| `nusrat@teslapool.dev` | Nusrat | Passenger (has ride history, ৳1,000 TeslaPay) |
| `rafiq@teslapool.dev` | Rafiq | Passenger (has ride history) |
| `shirin@teslapool.dev` | Shirin | Passenger (empty history on purpose) |
| `jashim@teslapool.dev` | Jashim | Driver of **Bullet** (3 seats, online in Banani) |
| `kamal@teslapool.dev` | Kamal | Driver of **Toofan** (2 seats, offline in Gulshan 1) |

Drivers are seeded only — driver onboarding means vehicle checks and is out of scope.

## API overview

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | public | Liveness; runs `SELECT 1` |
| POST | `/auth/signup` | public | Register a Passenger, grant the ৳500 welcome credit, start a session |
| POST | `/auth/login` | public | Email + password login |
| POST | `/auth/logout` | any | Clear the session cookie |
| GET | `/auth/me` | any | Profile, plus the Tesla for a Driver |
| GET | `/zones` | public | The fixed Zone list |
| GET | `/fare-estimate?from=&to=&seats=` | public | Distance plus solo and pooled fares |
| POST | `/ride-requests` | Passenger | Create a Ride Request |
| GET | `/ride-requests` | Passenger | Own rides, newest first |
| GET | `/ride-requests/:id` | Passenger | Own ride, its fare and its Timeline |
| POST | `/ride-requests/:id/cancel` | Passenger | Cancel while the rules allow |
| GET | `/teslapay` | Passenger | Balance and full ledger |
| PATCH | `/driver/status` | Driver | Go online/offline, set the current Zone |
| GET | `/driver/trip` | Driver | The Driver's active Trip |
| GET | `/driver/requests` | Driver | Compatible waiting requests in the current Zone |
| POST | `/driver/requests/:id/accept` | Driver | Accept a request into the Trip |
| GET | `/trips` | Driver | Trip history |
| GET | `/trips/:id` | Driver | One Trip with passengers and Ride Events |
| POST | `/trips/:id/arrive` | Driver | Mark arrival at pickup |
| POST | `/trips/:id/start` | Driver | Start the Trip and lock every Final Fare |
| POST | `/trips/:id/cancel` | Driver | Cancel before `STARTED`; Requeue the passengers |
| POST | `/trips/:id/requests/:requestId/drop-off` | Driver | Complete one passenger; last one completes the Trip |

Status codes are consistent: `401` no session, `403` wrong role, `404` another
user's resource, `409` invalid transition or lost race, `422` bad input.

## Domain rules

### Matching

A Ride Request is **Compatible** with a Trip when it shares the Trip's pickup
Zone, its destination is within 3 km straight-line of every destination already
on the Trip, it fits the free seats, the Trip has not reached Driver Arrived, and
neither side is a Solo Request. Worked for the story: Nusrat and Rafiq both start
in **Banani**, and Mohakhali ↔ Gulshan 1 are about **1.2 km** apart — under the
3 km limit — so Jashim can pool them. Shirin's Uttara request is ~11 km from
Mohakhali and is refused.

### Fare model

```
distanceM = round(haversine(pickup, dropoff) × 1.3 / 100) × 100
subtotal  = (3000 + distanceM × 2000 / 1000) × seats      # ৳30/seat + ৳20/km/seat
discount  = pooled ? round(subtotal × 25 / 100) : 0
total     = subtotal − discount
```

| Ride | Distance | Base | Distance charge | Subtotal | Pool Discount | Final |
| --- | --- | --- | --- | --- | --- | --- |
| Nusrat, Banani → Mohakhali, solo | 2.3 km | ৳30.00 | ৳46.00 | ৳76.00 | — | **৳76.00** |
| Nusrat, pooled | 2.3 km | ৳30.00 | ৳46.00 | ৳76.00 | −৳19.00 | **৳57.00** |
| Rafiq, Banani → Gulshan 1, solo | 2.5 km | ৳30.00 | ৳50.00 | ৳80.00 | — | **৳80.00** |
| Rafiq, pooled | 2.5 km | ৳30.00 | ৳50.00 | ৳80.00 | −৳20.00 | **৳60.00** |

The fare shown before booking is an **Estimated Fare** (solo and "if pooled").
The **Final Fare** is locked when the Trip starts, and afterwards it no longer
changes if other passengers cancel or drop off. Money is integer paisa because
BDT is counted in paisa: `distanceM` is always a multiple of 100 m and the
discount is a whole percentage, so every figure above is exact — no floats, no
drift, and a receipt that adds up by hand.

### Cancellation rules

- A Passenger may cancel while the request is `REQUESTED`, or while it is
  `MATCHED` and the Driver has not yet reached Driver Arrived. The seat is freed
  at once, and a new request can be made.
- Cancelling after the Driver has arrived, or once the ride is in progress or
  completed, is refused with `409`.
- When the last passenger on a Trip cancels, the Trip itself becomes `CANCELLED`.
- A Driver may cancel a Trip before it starts. Every passenger on it is
  **Requeued** back to `REQUESTED` with no Trip, so another Driver can pick them
  up — they are not punished for the Driver's change of mind.
- A Trip that has started cannot be cancelled; it ends by dropping passengers off.
- There are no cancellation fees.

### TeslaPay

- A new Passenger gets a **৳500 welcome credit** on signup, recorded as one `TOP_UP`
  row in `teslapay_transactions`.
- When requesting a ride the Passenger chooses **Cash** or **TeslaPay**.
- A TeslaPay ride is charged its Final Fare at Drop-off, in the same transaction
  as the Drop-off, and only once per Ride Request.
- A Passenger's balance is always the sum of their ledger rows; the TeslaPay page
  shows both.
- A cash ride never touches the ledger.
- TeslaPay has no overdraft. At request time a balance below the ride's solo
  Estimated Fare is rejected with `422` and the Passenger pays cash instead. If the
  balance somehow falls short by Drop-off, the charge is skipped, the payment
  method becomes **Cash**, and the `PAID` Ride Event records `fellBackToCash: true`
  with no ledger row.

## Concurrency

Bullet has one seat left. Nusrat and Shirin both tap Accept at the same instant,
and both requests were read while that seat still looked free. The claim is one
conditional statement inside the Accept transaction (ADR 0001):

```sql
UPDATE trips
   SET seats_taken = seats_taken + $n, is_solo = is_solo OR $solo
 WHERE id = $trip AND status = 'ACCEPTED' AND pickup_zone_id = $zone
   AND seats_taken + $n <= capacity
   AND (seats_taken = 0 OR (NOT is_solo AND $sharing))
RETURNING seats_taken
```

Postgres serialises the two updates on the Trip row, so exactly one returns a
row and the other returns none and becomes a `409`. The same transaction flips
the Ride Request with `UPDATE ... WHERE status = 'REQUESTED'`, so two Drivers
cannot Accept the same request either — the loser's Trip insert rolls back with
it.

The net has several layers:

- `CHECK (seats_taken <= capacity)` and `CHECK (seats BETWEEN 1 AND 3)` — if the
  application ever got the arithmetic wrong, the database still refuses.
- Partial unique index `trips_one_active_per_driver` — one active Trip per Driver.
- Partial unique index `ride_requests_one_active_per_passenger` — one active ride
  per Passenger.
- `SELECT ... FOR UPDATE` on the Trip row for Drop-off, so two concurrent last
  drop-offs cannot both complete the Trip.
- Conditioned `updateMany` calls everywhere a status changes, so a lost race is a
  `409` rather than a double write.

`api/test/pooling.test.ts` proves the last-seat race and the two-Driver race;
`api/test/trip-lifecycle.test.ts` proves the Drop-off and cancellation rules.

At larger scale this stays a per-Trip hot spot, which is exactly the right size:
contention is per vehicle, not global. If matching itself got slow, the next step
is a queue per Zone feeding idempotent matchers, not a bigger lock.

## Key decisions and trade-offs

- **Polling, not WebSockets.** Ride state changes on the scale of seconds; a 3-second
  poll is simpler to operate and honest about freshness. Cost: a request per open
  tab, and updates land up to 3 seconds late.
- **Driver-driven matching, not auto-assign.** A Driver chooses from Compatible
  requests, which mirrors how three-wheelers actually fill up and keeps a human in
  the loop. Cost: idle time if no Driver is online.
- **Fare locked at `STARTED`.** Passengers see a price before booking and it does
  not move afterwards, so a late cancellation does not silently change someone
  else's fare.
- **Zones, not real maps.** Ten centroids keep the matching rule checkable by hand
  and remove a map API and its key from the critical path. Cost: coarse pickup
  points and a straight-line distance with a documented `1.3` road factor.
- **Raw SQL in exactly one place.** Prisma cannot compare a column to an
  expression against another column, so the seat claim is raw — and everything
  else stays typed.
- **Capacity snapshot on `trips`.** A `CHECK` constraint cannot read another
  table, so the Trip copies the Tesla's capacity when it opens. If a Tesla's
  capacity ever changed mid-Trip, the Trip would keep the old number — which is
  the safer direction.

## Assumptions

- Drivers are seeded; there is no driver signup and no vehicle document checks.
- One active Ride Request per Passenger, and one active Trip per Driver.
- A Driver's current Zone is the pickup Zone they serve; there is no GPS.
- Co-riders are shown to a Passenger as a count only — never another passenger's
  name or fare.
- No ride expiry, no cancellation fees, no TeslaPay top-ups.

## Known limitations and next improvements

- A stale Ride Request never expires; it waits in the Zone forever until a Driver
  accepts or the Passenger cancels.
- No push notifications — a Passenger learns about a match by polling.
- The rate limiter trusts one proxy hop, but Vercel → Render is two, so behind the
  deployed setup client IPs can group at the edge and share a bucket. The real hop
  count should be set once measured.
- No refunds or fare adjustments after Drop-off.
- Zones are centroids with a fixed road factor; a real router would improve both
  distance and pickup accuracy.
- No driver earnings or payout view.

## If Oi Tesla goes viral

At 1M passengers and 100k drivers the same design bends, mostly at the edges:

```mermaid
flowchart LR
  LB[Load balancer] --> API1[API instance]
  LB --> API2[API instance]
  API1 --> PGp[("Postgres primary<br/>writes")]
  API1 --> PGr[("Read replicas<br/>history")]
  API1 --> R[(Redis: driver<br/>locations, hot reads)]
  API1 --> Q[[Matching queues<br/>per geo-cell]]
  Q --> API2
  API2 --> WS[SSE / WebSockets]
```

- **Scale out the API.** It is stateless apart from the cookie, so instances go
  behind a load balancer; sessions stay in the JWT and the database.
- **Move history off the primary.** Read replicas serve ride history and the
  Timeline; the primary keeps writes.
- **Replace Zones with geospatial search.** PostGIS or geohash cells find nearby
  drivers instead of ten hand-written centroids, and Redis holds driver locations
  for hot reads.
- **Queue the matching.** A queue per geo-cell with idempotent consumers absorbs
  bursts and lets matching retry without holding a request open.
- **Push instead of poll.** SSE or WebSockets for status, which removes the 3-second
  poll as the fleet grows.
- **Idempotency keys** on `POST /ride-requests` and on Accept, so a retried request
  cannot double-book.
- **Rate limits at the gateway**, per user and per IP, once the true proxy hop
  count is known.
- **Observability.** OpenTelemetry traces, RED metrics and alerting on the accept
  path.
- **Partition `ride_events` by month.** It is append-only and grows without bound;
  partitioning keeps the Timeline query fast.
- **Retry with backoff and a dead-letter queue** for the matching consumers, so a
  poisoned message is visible instead of lost.
- **Blue/green deploys with backward-compatible migrations**, so the schema can
  change while both versions run.

## AI Usage

_TODO(author) — write this section yourself, in your own words: which tools you
used and what for, one AI suggestion you accepted, and one you changed or
rejected and why._
