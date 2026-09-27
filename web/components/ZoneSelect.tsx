import { Label } from '@/components/ui/label';
import type { Zone } from '@/lib/types';

export const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm';

export function ZoneSelect(props: { id: string; label: string; zones: Zone[]; value: number | undefined; onChange: (id: number) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <select id={props.id} className={selectClass} value={props.value ?? ''} onChange={(e) => props.onChange(Number(e.target.value))}>
        <option value="" disabled>
          Choose a zone
        </option>
        {props.zones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.name}
          </option>
        ))}
      </select>
    </div>
  );
}
