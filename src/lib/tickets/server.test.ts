import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscordAttachment } from '@/lib/discord/types';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
    storage: {
      from: () => ({ upload: mocks.upload, remove: mocks.remove }),
    },
  }),
}));

import { createTicket } from '@/lib/tickets/server';

const attachment: DiscordAttachment = {
  id: 'attachment-1',
  filename: 'contexto.png',
  content_type: 'image/png',
  size: 4,
  url: 'https://cdn.discordapp.com/attachments/1/2/contexto.png',
};

describe('ticket image storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { 'content-type': 'image/png' },
        }),
      ),
    );
    mocks.upload.mockResolvedValue({ data: {}, error: null });
    mocks.rpc.mockResolvedValue({
      data: { publicId: 'ticket-id', title: 'Error', description: 'Detalle' },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        publicId: 'ticket-id',
        title: 'Error',
        description: 'Detalle',
        TicketImage: [],
      },
      error: null,
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('copia adjuntos válidos a Storage antes de crear el ticket', async () => {
    await createTicket(
      { title: 'Error', description: 'Detalle', type: 'BUG' },
      'DISCORD',
      { id: 'user-1', name: 'Operaciones', discordId: 'user-1' },
      [attachment],
    );

    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]+\/[0-9a-f-]+\.png$/),
      expect.any(ArrayBuffer),
      { contentType: 'image/png', upsert: false },
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      'create_ticket_with_images',
      expect.objectContaining({
        p_priority: 'MEDIA',
        p_images: [
          expect.objectContaining({
            fileName: 'contexto.png',
            mimeType: 'image/png',
            size: 4,
          }),
        ],
      }),
    );
  });

  it('rechaza URLs ajenas al CDN firmado de Discord', async () => {
    await expect(
      createTicket(
        { title: 'Error', description: 'Detalle', type: 'BUG' },
        'DISCORD',
        { id: 'user-1', name: 'Operaciones', discordId: 'user-1' },
        [{ ...attachment, url: 'https://example.com/contexto.png' }],
      ),
    ).rejects.toThrow('URL de archivo adjunto inválida');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['reporte.pdf', 'application/pdf', 'application/pdf', 'pdf'],
    [
      'Template_producto.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xlsx',
    ],
    [
      'datos.xls',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel',
      'xls',
    ],
    [
      'brief.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'docx',
    ],
    ['legacy.doc', 'application/msword', 'application/msword', 'doc'],
    ['README.md', 'text/plain', 'text/markdown', 'md'],
    [
      'display.icc',
      'application/octet-stream',
      'application/vnd.iccprofile',
      'icc',
    ],
    ['script.py', 'text/plain', 'text/x-python', 'py'],
  ])(
    'acepta el documento %s',
    async (fileName, responseMimeType, storedMimeType, extension) => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { 'content-type': responseMimeType },
        }),
      );
      const document = {
        ...attachment,
        filename: fileName,
        content_type: responseMimeType,
        url: `https://cdn.discordapp.com/attachments/1/2/${fileName}`,
      };

      await createTicket(
        { title: 'Documento', description: 'Detalle', type: 'REQUERIMIENTO' },
        'DISCORD',
        { id: 'user-1', name: 'Operaciones', discordId: 'user-1' },
        [document],
      );

      expect(mocks.upload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`\\.${extension}$`)),
        expect.any(ArrayBuffer),
        { contentType: storedMimeType, upsert: false },
      );
      expect(mocks.rpc).toHaveBeenCalledWith(
        'create_ticket_with_images',
        expect.objectContaining({
          p_images: [
            expect.objectContaining({
              fileName,
              mimeType: storedMimeType,
            }),
          ],
        }),
      );
    },
  );

  it('rechaza extensiones no permitidas aunque Discord entregue un MIME type', async () => {
    await expect(
      createTicket(
        { title: 'Archivo', description: 'Detalle', type: 'REQUERIMIENTO' },
        'DISCORD',
        { id: 'user-1', name: 'Operaciones', discordId: 'user-1' },
        [
          {
            ...attachment,
            filename: 'programa.exe',
            content_type: 'application/octet-stream',
          },
        ],
      ),
    ).rejects.toThrow('Formato de archivo no permitido: programa.exe');
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
