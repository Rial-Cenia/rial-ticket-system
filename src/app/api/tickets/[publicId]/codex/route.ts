import { getAuthenticatedUser } from '@/lib/auth';
import { apiError } from '@/lib/http';
import { createAdminClient } from '@/lib/supabase/admin';

interface Context {
  params: Promise<{ publicId: string }>;
}

export async function GET(_: Request, context: Context) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  try {
    const { publicId } = await context.params;
    const { data: run, error } = await createAdminClient()
      .from('CodexRun')
      .select(
        'id, status, repositoryFullName, branchName, pullRequestUrl, attemptNumber, retryCount, lastError, updatedAt',
      )
      .eq('ticketPublicId', publicId)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!run) return Response.json({ data: null });
    const { data: analysis, error: analysisError } = await createAdminClient()
      .from('CodexAnalysis')
      .select('decision, complexity, confidence, selectedRepository')
      .eq('runId', run.id)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (analysisError) throw new Error(analysisError.message);
    return Response.json({ data: { ...run, analysis } });
  } catch (error) {
    return apiError(error);
  }
}
