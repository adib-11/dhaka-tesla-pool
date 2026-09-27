import { Badge } from '@/components/ui/badge';

const LABELS: Record<string, string> = {
  REQUESTED: 'Waiting',
  MATCHED: 'Accepted',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ACCEPTED: 'Heading to pickup',
  DRIVER_ARRIVED: 'Driver arrived',
  STARTED: 'Trip started',
};

export function StatusBadge({ status }: { status: string }) {
  const variant = status === 'CANCELLED' ? 'destructive' : status === 'COMPLETED' ? 'secondary' : 'default';
  return <Badge variant={variant}>{LABELS[status] ?? status}</Badge>;
}
