import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next');
  const next =
    nextParam?.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/kanban';
  const supabase = await createClient();

  if (!code)
    return NextResponse.redirect(
      new URL('/login?error=Callback inválido', url.origin),
    );
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error)
    return NextResponse.redirect(
      new URL('/login?error=No se pudo iniciar sesión', url.origin),
    );

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (user?.app_metadata.provider === 'google') {
    const domain = user.email?.split('@')[1]?.toLowerCase();
    const allowed = getServerEnv()
      .AUTH_ALLOWED_GOOGLE_DOMAINS.split(',')
      .map((value) => value.trim().toLowerCase());
    if (!domain || !allowed.includes(domain)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL('/login?error=Dominio no autorizado', url.origin),
      );
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
