'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { StatusBadge } from '@/components/StatusBadge';
import { api, taka } from '@/lib/api';
import type { PassengerRide } from '@/lib/types';

function History() {
  const rides = useQuery({ queryKey: ['rides'], queryFn: () => api<PassengerRide[]>('/ride-requests') });
  if (rides.isPending) return <PageMessage>Loading history…</PageMessage>;
  if (rides.isError) return <PageMessage>{rides.error.message}</PageMessage>;
  if (!rides.data.length)
    return (
      <PageMessage>
        No rides yet.{' '}
        <Link className="underline" href="/ride">
          Request your first ride
        </Link>
      </PageMessage>
    );
  return (
    <ul className="space-y-2">
      {rides.data.map((r) => (
        <li key={r.id}>
          <Link href={`/rides/${r.id}`} className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted">
            <div>
              <p className="font-medium">
                {r.pickup.name} → {r.dropoff.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()} · {r.seats} seat{r.seats > 1 ? 's' : ''}
              </p>
            </div>
            <div className="space-y-1 text-right">
              <StatusBadge status={r.status} />
              <p className="text-sm">{r.fare ? taka(r.fare.finalFarePaisa) : `~${taka(r.estimatedSoloPaisa)}`}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function RidesPage() {
  return (
    <RequireRole role="PASSENGER">
      <h1 className="mb-4 text-xl font-semibold">Your rides</h1>
      <History />
    </RequireRole>
  );
}
