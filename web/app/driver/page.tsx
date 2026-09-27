'use client';
import { CompatibleRequests } from '@/components/CompatibleRequests';
import { CurrentTripPanel } from '@/components/CurrentTripPanel';
import { DriverStatusCard } from '@/components/DriverStatusCard';
import { PageMessage } from '@/components/PageMessage';
import { RequireRole } from '@/components/RequireRole';
import { useMe } from '@/lib/session';

function DriverHome() {
  const tesla = useMe().data?.tesla;
  if (!tesla) return <PageMessage>No Tesla is registered to this driver.</PageMessage>;
  return (
    <div className="space-y-4">
      <DriverStatusCard tesla={tesla} />
      <CurrentTripPanel />
      <CompatibleRequests online={tesla.isOnline} />
    </div>
  );
}

export default function DriverPage() {
  return (
    <RequireRole role="DRIVER">
      <DriverHome />
    </RequireRole>
  );
}
