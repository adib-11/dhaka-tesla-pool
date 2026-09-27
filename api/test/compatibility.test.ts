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
