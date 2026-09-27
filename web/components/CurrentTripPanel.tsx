'use client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { DriverTrip } from '@/lib/types';
import { PageMessage } from './PageMessage';
import { StatusBadge } from './StatusBadge';

export function CurrentTripPanel() {
  const trip = useQuery({ queryKey: ['driver-trip'], queryFn: () => api<DriverTrip | null>('/driver/trip'), refetchInterval: 3000 });
  if (trip.isPending) return <PageMessage>Loading current trip…</PageMessage>;
  if (trip.isError) return <PageMessage>{trip.error.message}</PageMessage>;
  if (!trip.data) return null;
  const t = trip.data;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Current trip from {t.pickup.name}</CardTitle>
        <StatusBadge status={t.status} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Seats {t.seatsTaken}/{t.capacity}
          {t.passengers.length > 1 && ' · Pool'}
          {t.isSolo && ' · Solo'}
        </p>
        <ul className="divide-y">
          {t.passengers.map((p) => (
            <li key={p.requestId} className="flex items-center justify-between gap-2 py-2">
              <span>
                {p.passengerName} · {p.seats} seat{p.seats > 1 ? 's' : ''} → {p.dropoff.name}
              </span>
              <StatusBadge status={p.status} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
