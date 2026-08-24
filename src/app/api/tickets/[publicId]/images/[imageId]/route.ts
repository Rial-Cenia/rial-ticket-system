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
    const image = await downloadTicketImage(publicId, imageId);
    if (!image)
      return Response.json({ error: 'Imagen no encontrada' }, { status: 404 });
    return new Response(image.data, {
      headers: {
        'content-type': image.mimeType,
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(image.fileName)}`,
        'cache-control': 'private, max-age=300',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
