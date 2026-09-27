'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ApiError } from '@/lib/api';
import { homeFor, useMe } from '@/lib/session';
import type { Role } from '@/lib/types';
import { PageMessage } from './PageMessage';

export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const signedOut = me.error instanceof ApiError && me.error.status === 401;
  const wrongRole = me.data !== undefined && me.data.role !== role;

  useEffect(() => {
    if (signedOut) router.replace('/login');
    else if (wrongRole) router.replace(homeFor(me.data!.role));
  }, [signedOut, wrongRole, me.data, router]);

  if (me.isPending || signedOut || wrongRole) return <PageMessage>Loading…</PageMessage>;
  if (me.isError) return <PageMessage>Could not reach the server: {me.error.message}</PageMessage>;
  return <>{children}</>;
}
