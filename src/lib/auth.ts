import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/lib/types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
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

    const admin = createAdminClient();
    const { error: insertError } = await admin
      .from('AppUser')
      .upsert(
        { userId: data.user.id },
        { onConflict: 'userId', ignoreDuplicates: true },
      );
    if (insertError) throw new Error(insertError.message);
    const { data: appUser, error: roleError } = await admin
      .from('AppUser')
      .select('role')
      .eq('userId', data.user.id)
      .single();
    if (roleError) throw new Error(roleError.message);

    return {
      id: data.user.id,
      email: data.user.email,
      name: displayName,
      role: appUser.role as AppRole,
    };
  },
);
