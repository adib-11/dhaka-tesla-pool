# Dhaka Tesla Pool

A ride-pooling service where passengers share seats in a driver's three-wheeled "Tesla" around Dhaka and each pays their own fare.

## Language

### People and vehicles

**Passenger**:
A person who books seats to travel from one Zone to another (e.g. Nusrat, Rafiq, Shirin).
_Avoid_: Rider, customer, user

**Driver**:
A person who operates one Tesla and accepts Ride Requests (e.g. Jashim).
_Avoid_: Captain, operator

**Tesla**:
A driver's vehicle with a fixed seat capacity (e.g. Bullet, 3 seats).
_Avoid_: Car, vehicle, CNG

### Rides

**Ride Request**:
One Passenger's booking for a number of seats between two Zones, with its own status and fare.
_Avoid_: Ride, booking, order

**Trip**:
One journey of one Tesla that carries one or more Ride Requests, with its own lifecycle.
_Avoid_: Ride, pool, journey

**Pool**:
A Trip that carries more than one Ride Request. This is a description of a Trip, not a separate thing.
_Avoid_: Group, share

**Solo Request**:
A Ride Request whose Passenger turned off "Allow sharing"; its Trip accepts no other Ride Requests and gets no Pool Discount.
_Avoid_: Private ride, exclusive ride

**Compatible**:
A Ride Request is Compatible with a Trip when it shares the Trip's pickup Zone, its destination lies within 3 km of every destination already on the Trip, it fits in the free seats, the Trip has not reached Driver Arrived, and neither side is a Solo Request.
_Avoid_: Matching, relevant

**Accept**:
The Driver's act of putting a Ride Request onto a Trip; the first Accept creates the Trip.
_Avoid_: Match, assign, claim

**Drop-off**:
The Driver's act of completing one Ride Request at its destination; the Trip completes when its last Ride Request is dropped off.
_Avoid_: Finish, end ride

**Ride Event**:
An append-only record of one thing that happened to a Trip or Ride Request (who, what, when, before/after status); together they form the ride's Timeline.
_Avoid_: Log, audit entry, history row

**Requeue**:
Returning a Ride Request to Requested when its Driver cancels the Trip before it starts, so the Passenger still gets a ride.
_Avoid_: Reset, unassign

### Geography

**Zone**:
A named Dhaka area from a fixed list, represented by one centroid point (e.g. Banani, Gulshan 1, Mohakhali).
_Avoid_: Area, location, place

### Money

**Paisa**:
The unit all money is kept in; 100 paisa = 1 taka (৳).
_Avoid_: Poysha, cents

**Estimated Fare**:
The fare shown to a Passenger before a Trip starts, given both as a solo figure and an "if pooled" figure.
_Avoid_: Quote, price

**Final Fare**:
The fare locked for a Ride Request when its Trip starts; it no longer changes if others cancel or drop off.
_Avoid_: Actual fare, charged fare

**Pool Discount**:
A 25% reduction applied to every Ride Request on a Trip that holds two or more active Ride Requests when it starts.
_Avoid_: Sharing discount, rebate

**TeslaPay**:
A simulated in-app wallet a Passenger can pay from instead of cash; charged at Drop-off.
_Avoid_: Wallet, credits, balance
