import { taka } from '@/lib/api';
import type { RideEvent } from '@/lib/types';

const LABELS: Record<string, string> = {
  REQUESTED: 'Ride requested',
  ACCEPTED: 'Driver accepted',
  JOINED_POOL: 'Joined a shared Tesla',
  DRIVER_ARRIVED: 'Driver arrived at pickup',
  STARTED: 'Trip started',
  FARE_LOCKED: 'Fare locked',
  DROPPED_OFF: 'Dropped off',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  REQUEUED: 'Driver cancelled; back in the queue',
  TRIP_COMPLETED: 'Trip completed',
};

function describe(e: RideEvent): string | null {
  const d = e.detail ?? {};
  const paisa = (key: string) => taka(Number(d[key]));
  switch (e.type) {
    case 'REQUESTED':
      return d.estimatedSoloPaisa ? `Estimated ${paisa('estimatedSoloPaisa')} solo, ${paisa('estimatedPooledPaisa')} if pooled` : null;
    case 'ACCEPTED':
    case 'JOINED_POOL':
      return `Seats ${d.seatsTaken}/${d.capacity}`;
    case 'FARE_LOCKED':
      return d.pooled
        ? `${paisa('totalPaisa')}: ${paisa('subtotalPaisa')} minus ${paisa('poolDiscountPaisa')} pool discount (${Number(d.passengersOnTrip)} passengers)`
        : `${paisa('totalPaisa')} (rode alone)`;
    case 'PAID':
      return `${paisa('amountPaisa')} by ${d.method === 'TESLAPAY' ? 'TeslaPay' : 'cash'}${d.fellBackToCash ? ' (TeslaPay fell back to cash)' : ''}`;
    case 'CANCELLED':
      return d.seatsFreed ? `${d.seatsFreed} seat(s) freed` : typeof d.reason === 'string' ? d.reason : null;
    default:
      return null;
  }
}

export function Timeline({ events }: { events: RideEvent[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No events yet.</p>;
  return (
    <ol className="space-y-4 border-l pl-5">
      {events.map((e) => {
        const note = describe(e);
        return (
          <li key={e.id} className="relative text-sm">
            <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            <p className="font-medium">{LABELS[e.type] ?? e.type}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {e.actorName && ` · ${e.actorName}`}
              {e.fromStatus && e.toStatus && ` · ${e.fromStatus} → ${e.toStatus}`}
            </p>
            {note && <p className="text-muted-foreground">{note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
