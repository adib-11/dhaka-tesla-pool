'use client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { useMe } from '@/lib/session';

function DriverHome() {
  const tesla = useMe().data?.tesla;
  if (!tesla) return <PageMessage>No Tesla is registered to this driver.</PageMessage>;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          {tesla.name} · {tesla.capacity} seats
        </CardTitle>
        <Badge variant={tesla.isOnline ? 'default' : 'outline'}>{tesla.isOnline ? 'Online' : 'Offline'}</Badge>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{tesla.plate}</CardContent>
    </Card>
  );
}

export default function DriverPage() {
  return (
    <RequireRole role="DRIVER">
      <DriverHome />
    </RequireRole>
  );
}
