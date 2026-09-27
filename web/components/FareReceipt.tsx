import { taka } from '@/lib/api';
import type { LockedFare } from '@/lib/types';

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'border-t pt-1 font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function FareReceipt({ fare }: { fare: LockedFare }) {
  return (
    <dl className="space-y-1 text-sm">
      <Row label="Base fare" value={taka(fare.basePaisa)} />
      <Row label="Distance charge" value={taka(fare.distanceChargePaisa)} />
      {fare.poolDiscountPaisa > 0 && <Row label="Pool discount (25%)" value={`−${taka(fare.poolDiscountPaisa)}`} />}
      <Row label="Your fare" value={taka(fare.finalFarePaisa)} strong />
    </dl>
  );
}
