'use client';
import { RequireRole } from '@/components/RequireRole';
import { RideRequestForm } from '@/components/RideRequestForm';

export default function RidePage() {
  return (
    <RequireRole role="PASSENGER">
      <RideRequestForm />
    </RequireRole>
  );
}
