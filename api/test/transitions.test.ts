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
