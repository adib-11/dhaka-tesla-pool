'use client';
import { useQuery } from '@tanstack/react-query';
import { ActiveRideCard } from '@/components/ActiveRideCard';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { RideRequestForm } from '@/components/RideRequestForm';
import { api } from '@/lib/api';
import { ACTIVE_REQUEST_STATUSES, type PassengerRide } from '@/lib/types';

function RideHome() {
  const rides = useQuery({ queryKey: ['rides'], queryFn: () => api<PassengerRide[]>('/ride-requests'), refetchInterval: 3000 });
  if (rides.isPending) return <PageMessage>Loading your rides…</PageMessage>;
  if (rides.isError) return <PageMessage>{rides.error.message}</PageMessage>;
  const active = rides.data.find((r) => ACTIVE_REQUEST_STATUSES.includes(r.status));
  return active ? <ActiveRideCard rideId={active.id} /> : <RideRequestForm />;
}

export default function RidePage() {
  return (
    <RequireRole role="PASSENGER">
      <RideHome />
    </RequireRole>
  );
}
