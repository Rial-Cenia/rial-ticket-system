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
    ).rejects.toThrow('URL de imagen inválida');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
