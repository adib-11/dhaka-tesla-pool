'use client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { api, km, taka } from '@/lib/api';
import type { CompatibleRequest } from '@/lib/types';
import { PageMessage } from './PageMessage';

export function CompatibleRequests({ online }: { online: boolean }) {
  const list = useQuery({
    queryKey: ['driver-requests'],
    queryFn: () => api<CompatibleRequest[]>('/driver/requests'),
    refetchInterval: 3000,
    enabled: online,
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
          <CardContent className="text-sm">
            <p className="font-medium">
              {r.passengerName} · {r.seats} seat{r.seats > 1 ? 's' : ''}
              {!r.allowSharing && ' · solo'}
            </p>
            <p className="text-muted-foreground">
              {r.pickup.name} → {r.dropoff.name} · {km(r.distanceM)} · {taka(r.estimatedSoloPaisa)}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
