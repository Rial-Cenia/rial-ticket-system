import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  actor: {
    id: '9dfab459-1c46-4e50-a00f-111111111111',
    email: 'user@rial.cl',
    name: 'Beatriz',
    role: 'USER' as const,
  },
  create: vi.fn(),
  list: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  requireApiUser: vi.fn(() => mocks.actor),
}));

vi.mock('@/lib/kanbans/comments', () => ({
  createKanbanCardComment: mocks.create,
  listKanbanCardComments: mocks.list,
}));

import {
  GET,
  POST,
} from '@/app/api/kanbans/[kanbanId]/cards/[cardId]/comments/route';

const context = {
  params: Promise.resolve({
    kanbanId: '0572a4c0-0a72-4b40-9b51-111111111111',
    cardId: '2f0672cb-cf85-4b9b-8794-111111111111',
  }),
};

describe('kanban card comments route', () => {
  it('lista comentarios de una tarjeta autorizada', async () => {
    mocks.list.mockResolvedValue([{ id: 'comment-1' }]);

    const response = await GET(new Request('http://localhost'), context);

    expect(mocks.list).toHaveBeenCalledWith(
      mocks.actor,
      '0572a4c0-0a72-4b40-9b51-111111111111',
      '2f0672cb-cf85-4b9b-8794-111111111111',
    );
    await expect(response.json()).resolves.toEqual({
      data: [{ id: 'comment-1' }],
    });
  });

  it('valida y entrega el comentario al servicio', async () => {
    mocks.create.mockResolvedValue({ id: 'comment-1' });
    const formData = new FormData();
    formData.set('content', 'Necesito confirmar este punto');

    const response = await POST(
      new Request('http://localhost', { method: 'POST', body: formData }),
      context,
    );

    expect(mocks.create).toHaveBeenCalledWith(
      mocks.actor,
      '0572a4c0-0a72-4b40-9b51-111111111111',
      '2f0672cb-cf85-4b9b-8794-111111111111',
      'Necesito confirmar este punto',
      [],
    );
    expect(response.status).toBe(201);
  });
});
