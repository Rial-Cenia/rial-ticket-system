import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  downloadTicketImage: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));

vi.mock('@/lib/tickets/server', () => ({
  downloadTicketImage: mocks.downloadTicketImage,
}));

import { GET } from '@/app/api/tickets/[publicId]/images/[imageId]/route';

const context = {
  params: Promise.resolve({ publicId: 'ticket-1', imageId: 'file-1' }),
};

describe('ticket attachment route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
  });

  it('descarga documentos en vez de mostrarlos inline', async () => {
    mocks.downloadTicketImage.mockResolvedValue({
      data: new Blob(['document']),
      fileName: 'Template_producto.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const response = await GET(new Request('http://localhost'), context);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe(
      "attachment; filename*=UTF-8''Template_producto.xlsx",
    );
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('mantiene las imágenes inline', async () => {
    mocks.downloadTicketImage.mockResolvedValue({
      data: new Blob(['image']),
      fileName: 'captura.png',
      mimeType: 'image/png',
    });

    const response = await GET(new Request('http://localhost'), context);

    expect(response.headers.get('content-disposition')).toBe(
      "inline; filename*=UTF-8''captura.png",
    );
  });
});
