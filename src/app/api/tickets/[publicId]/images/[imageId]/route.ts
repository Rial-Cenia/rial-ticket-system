import { getAuthenticatedUser } from '@/lib/auth';
import { apiError } from '@/lib/http';
import { downloadTicketImage } from '@/lib/tickets/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string; imageId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const { publicId, imageId } = await params;
    const file = await downloadTicketImage(publicId, imageId);
    if (!file)
      return Response.json({ error: 'Adjunto no encontrado' }, { status: 404 });
    const disposition = file.mimeType.startsWith('image/')
      ? 'inline'
      : 'attachment';
    return new Response(file.data, {
      headers: {
        'content-type': file.mimeType,
        'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'cache-control': 'private, max-age=300',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
