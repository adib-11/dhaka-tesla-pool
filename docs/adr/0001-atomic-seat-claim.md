# Seat capacity is claimed with one atomic conditional UPDATE

When two Accepts race for Bullet's last seat (Nusrat and Shirin), exactly one must win. We claim seats with a single `UPDATE trips SET seats_taken = seats_taken + $n WHERE id = $1 AND status = 'ACCEPTED' AND seats_taken + $n <= capacity RETURNING *` inside the Accept transaction, backed by a `CHECK (seats_taken <= capacity)` constraint, and flip the Ride Request with `UPDATE ... WHERE status = 'REQUESTED'` so two Drivers cannot Accept the same request. This is raw SQL inside an otherwise-Prisma codebase on purpose: Prisma cannot express a column-to-expression comparison, and a single conditional statement needs no explicit lock handling, unlike `SELECT ... FOR UPDATE` or optimistic version retries.

## Consequences

`trips.capacity` is a snapshot of the Tesla's capacity at Trip creation, because a CHECK constraint cannot read another table. At larger scale, the same row becomes a hot spot per Trip only, which is fine; contention is per vehicle, not global.
