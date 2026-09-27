'use client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { api, taka } from '@/lib/api';
import type { TeslapayLedger } from '@/lib/types';

function Ledger() {
  const teslapay = useQuery({ queryKey: ['teslapay'], queryFn: () => api<TeslapayLedger>('/teslapay') });
  if (teslapay.isPending) return <PageMessage>Loading your TeslaPay…</PageMessage>;
  if (teslapay.isError) return <PageMessage>{teslapay.error.message}</PageMessage>;
  const { balancePaisa, entries } = teslapay.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>TeslaPay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-3xl font-semibold">{taka(balancePaisa)}</p>
          <p className="text-sm text-muted-foreground">A ride paid with TeslaPay is charged its Final Fare at Drop-off.</p>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold">Ledger</h2>
      {entries.length === 0 ? (
        <PageMessage>No TeslaPay activity yet.</PageMessage>
      ) : (
        <ul className="divide-y rounded-md border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-medium">{e.type === 'TOP_UP' ? 'Welcome credit' : 'Ride charge'}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()}
                  {e.ride && ` · ${e.ride.pickup.name} → ${e.ride.dropoff.name}`}
                </p>
              </div>
              <div className="text-right">
                <p className={e.amountPaisa < 0 ? 'text-destructive' : 'text-green-600'}>
                  {e.amountPaisa < 0 ? '−' : '+'}
                  {taka(Math.abs(e.amountPaisa))}
                </p>
                <p className="text-xs text-muted-foreground">Balance {taka(e.balanceAfterPaisa)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TeslapayPage() {
  return (
    <RequireRole role="PASSENGER">
      <Ledger />
    </RequireRole>
  );
}
