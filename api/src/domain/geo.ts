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
