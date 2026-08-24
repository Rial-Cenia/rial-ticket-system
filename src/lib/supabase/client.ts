'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from '@/lib/env/public';

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  const { supabaseUrl, supabaseKey } = getPublicEnv();
  client ??= createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}
