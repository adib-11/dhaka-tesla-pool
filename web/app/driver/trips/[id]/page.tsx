'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { StatusBadge } from '@/components/StatusBadge';
import { Timeline } from '@/components/Timeline';
import { api, taka } from '@/lib/api';
import type { DriverTrip } from '@/lib/types';

function TripDetail({ id }: { id: string }) {
  const trip = useQuery({ queryKey: ['driver-trip', id], queryFn: () => api<DriverTrip>(`/trips/${id}`), refetchInterval: 3000 });
  if (trip.isPending) return <PageMessage>Loading trip…</PageMessage>;
  if (trip.isError) return <PageMessage>{trip.error.message}</PageMessage>;
  const t = trip.data;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Trip from {t.pickup.name}</CardTitle>
          <StatusBadge status={t.status} />
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            {new Date(t.createdAt).toLocaleString()} · seats {t.seatsTaken}/{t.capacity}
          </p>
          <ul className="divide-y">
            {t.passengers.map((p) => (
              <li key={p.requestId} className="flex justify-between py-2">
                <span>
                  {p.passengerName} → {p.dropoff.name} · {p.seats} seat{p.seats > 1 ? 's' : ''}
                </span>
                <span>{p.finalFarePaisa !== null ? taka(p.finalFarePaisa) : <StatusBadge status={p.status} />}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>What happened</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline events={t.events ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function DriverTripPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireRole role="DRIVER">
      <TripDetail id={id} />
    </RequireRole>
  );
}
