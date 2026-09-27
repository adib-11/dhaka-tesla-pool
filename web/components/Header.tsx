'use client';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { api, taka } from '@/lib/api';
import { useMe } from '@/lib/session';

export function Header() {
  const me = useMe();
  const qc = useQueryClient();
  const router = useRouter();

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    qc.clear();
    router.replace('/login');
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <Link href="/" className="font-semibold">
          Dhaka Tesla Pool
        </Link>
        {me.data && (
          <>
            <nav className="flex gap-3 text-sm">
              {me.data.role === 'PASSENGER' ? (
                <>
                  <Link href="/ride">Ride</Link>
                  <Link href="/rides">History</Link>
                </>
              ) : (
                <>
                  <Link href="/driver">Dashboard</Link>
                  <Link href="/driver/trips">Trips</Link>
                </>
              )}
            </nav>
            <span className="ml-auto text-sm text-muted-foreground">
              {me.data.name}
              {me.data.role === 'PASSENGER' && ` · TeslaPay ${taka(me.data.teslapayBalancePaisa)}`}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Log out
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
