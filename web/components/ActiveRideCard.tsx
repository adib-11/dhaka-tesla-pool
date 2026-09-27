'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, taka } from '@/lib/api';
import type { PassengerRide } from '@/lib/types';
import { FareReceipt } from './FareReceipt';
import { PageMessage } from './PageMessage';
import { StatusBadge } from './StatusBadge';

function headline(r: PassengerRide) {
  if (r.status === 'REQUESTED') return 'Waiting for a Tesla to accept your ride';
  if (r.status === 'MATCHED' && r.trip?.status === 'DRIVER_ARRIVED') return `${r.trip.teslaName} is waiting for you at ${r.pickup.name}`;
  if (r.status === 'MATCHED' && r.trip) return `${r.trip.driverName} is heading to you in ${r.trip.teslaName}`;
  if (r.status === 'IN_PROGRESS') return `On the way to ${r.dropoff.name}`;
  return '';
}

export function ActiveRideCard({ rideId }: { rideId: string }) {
  const qc = useQueryClient();
  const ride = useQuery({ queryKey: ['ride', rideId], queryFn: () => api<PassengerRide>(`/ride-requests/${rideId}`), refetchInterval: 3000 });
  const cancel = useMutation({
    mutationFn: () => api<PassengerRide>(`/ride-requests/${rideId}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      toast('Ride cancelled');
      qc.invalidateQueries({ queryKey: ['rides'] });
      qc.invalidateQueries({ queryKey: ['ride', rideId] });
    },
    onError: (err) => toast.error(err.message),
  });

  if (ride.isPending) return <PageMessage>Loading your ride…</PageMessage>;
  if (ride.isError) return <PageMessage>{ride.error.message}</PageMessage>;
  const r = ride.data;
  const cancellable = r.status === 'REQUESTED' || (r.status === 'MATCHED' && r.trip?.status === 'ACCEPTED');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          {r.pickup.name} → {r.dropoff.name}
        </CardTitle>
        <StatusBadge status={r.status} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-base">{headline(r)}</p>
        {r.trip && (
          <p className="text-muted-foreground">
            {r.trip.teslaName} · {r.trip.plate}
          </p>
        )}
        {!!r.trip?.coRiders && (
          <Badge variant="outline">
            Sharing with {r.trip.coRiders} other passenger{r.trip.coRiders > 1 ? 's' : ''}
          </Badge>
        )}
        {r.fare ? (
          <FareReceipt fare={r.fare} />
        ) : (
          <p>
            Estimated {taka(r.estimatedSoloPaisa)} solo{r.allowSharing && ', 25% off if pooled'}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {cancellable && (
            <Button variant="destructive" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel ride
            </Button>
          )}
          <Button variant="outline" render={<Link href={`/rides/${r.id}`} />}>
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
