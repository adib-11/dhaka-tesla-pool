'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FareReceipt } from '@/components/FareReceipt';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { StatusBadge } from '@/components/StatusBadge';
import { api, km, taka } from '@/lib/api';
import type { PassengerRide } from '@/lib/types';

function RideDetail({ id }: { id: string }) {
  const ride = useQuery({ queryKey: ['ride', id], queryFn: () => api<PassengerRide>(`/ride-requests/${id}`), refetchInterval: 3000 });
  if (ride.isPending) return <PageMessage>Loading ride…</PageMessage>;
  if (ride.isError) return <PageMessage>{ride.error.message}</PageMessage>;
  const r = ride.data;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>
            {r.pickup.name} → {r.dropoff.name}
          </CardTitle>
          <StatusBadge status={r.status} />
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {new Date(r.createdAt).toLocaleString()} · {km(r.distanceM)} · {r.seats} seat{r.seats > 1 ? 's' : ''} ·{' '}
            {r.paymentMethod === 'TESLAPAY' ? 'TeslaPay' : 'Cash'}
          </p>
          {r.trip && (
            <p>
              {r.trip.driverName} · {r.trip.teslaName} ({r.trip.plate})
              {!!r.trip.coRiders && ` · pooled with ${r.trip.coRiders} other`}
            </p>
          )}
          {r.fare ? <FareReceipt fare={r.fare} /> : <p>Estimated {taka(r.estimatedSoloPaisa)} solo</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RideDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireRole role="PASSENGER">
      <RideDetail id={id} />
    </RequireRole>
  );
}
