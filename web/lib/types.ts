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
