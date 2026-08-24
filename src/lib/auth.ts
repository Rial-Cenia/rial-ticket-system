import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export const getAuthenticatedUser = cache(
  async (): Promise<AuthenticatedUser | null> => {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims();
    if (claimsError || !claimsData?.claims?.sub) return null;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) return null;

    const displayName =
      typeof data.user.user_metadata?.full_name === 'string'
        ? data.user.user_metadata.full_name
        : data.user.email;

    return { id: data.user.id, email: data.user.email, name: displayName };
  },
);
