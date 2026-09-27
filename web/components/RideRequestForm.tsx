'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageMessage } from '@/components/PageMessage';
import { selectClass, ZoneSelect } from '@/components/ZoneSelect';
import { api, km, taka } from '@/lib/api';
import type { FareEstimate, Zone } from '@/lib/types';

/** Picks two Zones and a seat count, then shows the Estimated Fare both solo and "if pooled". */
export function RideRequestForm() {
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api<Zone[]>('/zones'), staleTime: Infinity });
  const [pickupZoneId, setPickup] = useState<number>();
  const [dropoffZoneId, setDropoff] = useState<number>();
  const [seats, setSeats] = useState(1);

  const sameZone = pickupZoneId !== undefined && pickupZoneId === dropoffZoneId;
  const ready = pickupZoneId !== undefined && dropoffZoneId !== undefined && !sameZone;

  const estimate = useQuery({
    queryKey: ['estimate', pickupZoneId, dropoffZoneId, seats],
    queryFn: () => api<FareEstimate>(`/fare-estimate?from=${pickupZoneId}&to=${dropoffZoneId}&seats=${seats}`),
    enabled: ready,
  });

  if (zones.isPending) return <PageMessage>Loading zones…</PageMessage>;
  if (zones.isError) return <PageMessage>Could not load zones: {zones.error.message}</PageMessage>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where to?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ZoneSelect id="pickup" label="Pickup" zones={zones.data} value={pickupZoneId} onChange={setPickup} />
        <ZoneSelect id="dropoff" label="Destination" zones={zones.data} value={dropoffZoneId} onChange={setDropoff} />
        {sameZone && <p className="text-sm text-destructive">Pickup and destination must be different.</p>}

        <div className="space-y-1">
          <Label htmlFor="seats">Seats</Label>
          <select id="seats" className={selectClass} value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {ready &&
          (estimate.isPending ? (
            <p className="text-sm text-muted-foreground">Calculating fare…</p>
          ) : estimate.isError ? (
            <p className="text-sm text-destructive">{estimate.error.message}</p>
          ) : (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                {estimate.data.pickup.name} → {estimate.data.dropoff.name} · {km(estimate.data.distanceM)}
              </p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solo</span>
                  <span className="font-semibold">{taka(estimate.data.solo.totalPaisa)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">If pooled (25% off)</span>
                  <span className="font-semibold">{taka(estimate.data.pooled.totalPaisa)}</span>
                </div>
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
