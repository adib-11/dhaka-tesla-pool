'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { DEMO_CAST, DEMO_PASSWORD } from '@/lib/demo';
import { homeFor } from '@/lib/session';
import type { Me } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) => api<Me>('/auth/login', { body }),
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      router.replace(homeFor(me.role));
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate({ email, password });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Demo: sign in as someone from the Banani story</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_CAST.map((c) => (
                <Button key={c.email} variant="secondary" disabled={login.isPending} onClick={() => login.mutate({ email: c.email, password: DEMO_PASSWORD })}>
                  {c.name} · {c.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm">
          New passenger?{' '}
          <Link className="underline" href="/signup">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
