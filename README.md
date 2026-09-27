# Dhaka Tesla Pool

Share a seat. Split the fare. Survive Dhaka traffic.

Work in progress. See `docs/implementation-plan.md` for the plan and `CONTEXT.md` for the domain language.

## Money

All money is integer **paisa** (100 paisa = ৳1); no floats.

## TeslaPay

TeslaPay is the simulated in-app wallet a Passenger can pay from instead of cash.

- A new Passenger gets a **৳500 welcome credit** on signup, recorded as a single `TOP_UP` ledger row.
- When requesting a ride a Passenger chooses **Cash** or **TeslaPay**.
- A TeslaPay ride is charged its **Final Fare at Drop-off**, in the same transaction as the Drop-off itself, and only once per Ride Request.
- Every credit and charge is a row in `teslapay_transactions`. A Passenger's balance is always the sum of those rows, and the Passenger can see both on their TeslaPay page.
- A cash ride never touches the ledger.

### When the balance is too low

TeslaPay has no overdraft. A balance that cannot cover the fare is handled deterministically in two places:

1. **At request time.** If the balance is below the ride's solo Estimated Fare — the most the ride can cost, since pooling only discounts it — `POST /ride-requests` is rejected with **422** (`Not enough TeslaPay balance for this ride; choose cash instead`), and the Passenger pays cash instead.
2. **At Drop-off.** If the balance fell below the Final Fare after the ride was requested (possible only if it changed out of band), the charge is skipped, the Ride Request's payment method becomes **Cash**, and the `PAID` Ride Event records `fellBackToCash: true`. No ledger row is written.
