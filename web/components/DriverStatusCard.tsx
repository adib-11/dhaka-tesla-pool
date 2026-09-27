'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { Me, Zone } from '@/lib/types';
import { ZoneSelect } from './ZoneSelect';

export function DriverStatusCard({ tesla }: { tesla: NonNullable<Me['tesla']> }) {
  const qc = useQueryClient();
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api<Zone[]>('/zones'), staleTime: Infinity });
  const update = useMutation({
    mutationFn: (body: { isOnline: boolean; currentZoneId: number }) => api<Me>('/driver/status', { method: 'PATCH', body }),
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      qc.invalidateQueries({ queryKey: ['driver-requests'] });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          {tesla.name} · {tesla.capacity} seats
        </CardTitle>
        <Badge variant={tesla.isOnline ? 'default' : 'outline'}>{tesla.isOnline ? 'Online' : 'Offline'}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {zones.data && (
          <ZoneSelect
            id="zone"
            label="Current zone"
            zones={zones.data}
            value={tesla.currentZoneId ?? undefined}
            onChange={(id) => update.mutate({ isOnline: tesla.isOnline, currentZoneId: id })}
          />
        )}
        <Button
          className="w-full"
          variant={tesla.isOnline ? 'outline' : 'default'}
          disabled={update.isPending || tesla.currentZoneId === null}
          onClick={() => update.mutate({ isOnline: !tesla.isOnline, currentZoneId: tesla.currentZoneId! })}
        >
          {tesla.isOnline ? 'Go offline' : 'Go online'}
        </Button>
      </CardContent>
    </Card>
  );
}
