'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RequireRole } from '@/components/RequireRole';
import { useMe } from '@/lib/session';

function PassengerHome() {
  const me = useMe().data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hello, {me?.name}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Book a Tesla from one Zone to another, share the seats, and pay only your own fare.
      </CardContent>
    </Card>
  );
}

export default function RidePage() {
  return (
    <RequireRole role="PASSENGER">
      <PassengerHome />
    </RequireRole>
  );
}
