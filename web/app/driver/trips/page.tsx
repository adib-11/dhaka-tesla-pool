'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import type { DriverTrip } from '@/lib/types';

function Trips() {
  const trips = useQuery({ queryKey: ['driver-trips'], queryFn: () => api<DriverTrip[]>('/trips') });
  if (trips.isPending) return <PageMessage>Loading trips…</PageMessage>;
  if (trips.isError) return <PageMessage>{trips.error.message}</PageMessage>;
  if (!trips.data.length) return <PageMessage>No trips yet. Go online and accept a request.</PageMessage>;
  return (
    <ul className="space-y-2">
      {trips.data.map((t) => (
        <li key={t.id}>
          <Link href={`/driver/trips/${t.id}`} className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted">
            <div>
              <p className="font-medium">
                From {t.pickup.name} · {t.passengers.map((p) => p.passengerName).join(', ') || 'no passengers'}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(t.createdAt).toLocaleString()} · seats {t.seatsTaken}/{t.capacity}
              </p>
            </div>
            <StatusBadge status={t.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function DriverTripsPage() {
  return (
    <RequireRole role="DRIVER">
      <h1 className="mb-4 text-xl font-semibold">Your trips</h1>
      <Trips />
    </RequireRole>
  );
}
