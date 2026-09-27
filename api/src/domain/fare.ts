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
