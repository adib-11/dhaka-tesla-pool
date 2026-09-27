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
