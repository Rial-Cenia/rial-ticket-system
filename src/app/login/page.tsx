'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-zinc-950" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(searchParams.get('error') ?? '');
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const { error: loginError } = await createClient().auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) {
      setError('Email o contraseña incorrectos.');
      setLoading(false);
      return;
    }
    router.replace('/kanban');
    router.refresh();
  }

  async function loginWithGoogle() {
    setLoading(true);
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/kanban`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900/85 p-8 shadow-2xl backdrop-blur">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-blue-600">
            <LockKeyhole className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Ticketera Rial</h1>
            <p className="text-sm text-zinc-500">Acceso interno</p>
          </div>
        </div>
        <Button
          className="w-full"
          variant="outline"
          onClick={loginWithGoogle}
          disabled={loading}
        >
          Continuar con Google
        </Button>
        <div className="my-6 flex items-center gap-3 text-xs text-zinc-600">
          <span className="h-px flex-1 bg-white/10" />o usa una cuenta asignada
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <form className="space-y-4" onSubmit={login}>
          <label className="block space-y-1.5 text-sm text-zinc-300">
            Email
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm text-zinc-300">
            Contraseña
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </p>
          )}
          <Button className="w-full" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </section>
    </main>
  );
}
