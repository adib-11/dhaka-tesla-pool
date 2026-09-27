'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { DriverTrip } from '@/lib/types';

function useTripAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api<DriverTrip>(path, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-trip'] });
      qc.invalidateQueries({ queryKey: ['driver-requests'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function TripActions({ trip }: { trip: DriverTrip }) {
  const act = useTripAction();
  const base = `/trips/${trip.id}`;
  const cancellable = trip.status === 'ACCEPTED' || trip.status === 'DRIVER_ARRIVED';
  return (
    <div className="flex flex-wrap gap-2">
      {trip.status === 'ACCEPTED' && (
        <Button disabled={act.isPending} onClick={() => act.mutate(`${base}/arrive`)}>
          Arrived at pickup
        </Button>
      )}
      {trip.status === 'DRIVER_ARRIVED' && (
        <Button disabled={act.isPending} onClick={() => act.mutate(`${base}/start`)}>
          Start trip
        </Button>
      )}
      {cancellable && (
        <Button
          variant="destructive"
          disabled={act.isPending}
          onClick={() => {
            if (confirm('Cancel this trip? Your passengers go back to the queue.')) act.mutate(`${base}/cancel`);
          }}
        >
          Cancel trip
        </Button>
      )}
    </div>
  );
}

export function DropOffButton({ tripId, requestId, name }: { tripId: string; requestId: string; name: string }) {
  const act = useTripAction();
  return (
    <Button size="sm" disabled={act.isPending} onClick={() => act.mutate(`/trips/${tripId}/requests/${requestId}/drop-off`)}>
      Drop off {name}
    </Button>
  );
}
