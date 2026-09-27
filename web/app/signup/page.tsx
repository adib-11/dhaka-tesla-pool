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
import type { Me } from '@/lib/types';

export default function SignupPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const signup = useMutation({
    mutationFn: () => api<Me>('/auth/signup', { body: form }),
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      router.replace('/ride');
    },
    onError: (err) => toast.error(err.message),
  });

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a passenger account</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            signup.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required maxLength={80} autoComplete="name" {...field('name')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" {...field('email')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password (8+ characters)</Label>
            <Input id="password" type="password" required minLength={8} autoComplete="new-password" {...field('password')} />
          </div>
          <Button type="submit" className="w-full" disabled={signup.isPending}>
            {signup.isPending ? 'Creating account…' : 'Sign up'}
          </Button>
          <p className="text-sm">
            Already riding?{' '}
            <Link className="underline" href="/login">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
