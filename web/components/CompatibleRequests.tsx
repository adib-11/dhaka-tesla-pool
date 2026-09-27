'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api, km, taka } from '@/lib/api';
import type { CompatibleRequest, DriverTrip } from '@/lib/types';
import { PageMessage } from './PageMessage';

export function CompatibleRequests({ online }: { online: boolean }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['driver-requests'],
    queryFn: () => api<CompatibleRequest[]>('/driver/requests'),
    refetchInterval: 3000,
    enabled: online,
  });
  const accept = useMutation({
    mutationFn: (id: string) => api<DriverTrip>(`/driver/requests/${id}/accept`, { method: 'POST' }),
    onSuccess: (trip) => {
      qc.setQueryData(['driver-trip'], trip);
      qc.invalidateQueries({ queryKey: ['driver-requests'] });
    },
    onError: (err) => {
      toast.error(err.message);
      qc.invalidateQueries({ queryKey: ['driver-requests'] });
    },
  });

  if (!online) return <PageMessage>Go online to see ride requests.</PageMessage>;
  if (list.isPending) return <PageMessage>Looking for requests…</PageMessage>;
  if (list.isError) return <PageMessage>{list.error.message}</PageMessage>;
  if (!list.data.length) return <PageMessage>No compatible requests right now.</PageMessage>;

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">Requests you can take</h2>
      {list.data.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium">
                {r.passengerName} · {r.seats} seat{r.seats > 1 ? 's' : ''}
                {!r.allowSharing && ' · solo'}
              </p>
              <p className="text-muted-foreground">
                {r.pickup.name} → {r.dropoff.name} · {km(r.distanceM)} · {taka(r.estimatedSoloPaisa)}
              </p>
            </div>
            <Button disabled={accept.isPending} onClick={() => accept.mutate(r.id)}>
              Accept
            </Button>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
