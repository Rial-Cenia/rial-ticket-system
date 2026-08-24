import { describe, expect, it } from 'vitest';
import {
  parseStatusId,
  parseTicketAttachments,
  parseTicketModal,
  parseTriageId,
} from '@/lib/discord/interactions';
import type { DiscordInteraction } from '@/lib/discord/types';

const publicId = '3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71';

describe('Discord interactions', () => {
  it('extrae inputs anidados del modal components v2', () => {
    const interaction = {
      data: {
        components: [
          {
            type: 18,
            component: { custom_id: 'ticket_title', value: 'Error crítico' },
          },
          {
            type: 18,
            component: { custom_id: 'ticket_description', value: 'No carga' },
          },
          {
            type: 18,
            component: { custom_id: 'ticket_type', values: ['BUG'] },
          },
        ],
      },
    } as unknown as DiscordInteraction;
    expect(parseTicketModal(interaction)).toMatchObject({
      title: 'Error crítico',
      description: 'No carga',
      type: 'BUG',
    });
  });

  it('resuelve las imágenes seleccionadas por el file upload de Discord', () => {
    const interaction = {
      data: {
        components: [
          {
            type: 18,
            component: {
              custom_id: 'ticket_images',
              values: ['attachment-1'],
            },
          },
        ],
        resolved: {
          attachments: {
            'attachment-1': {
              id: 'attachment-1',
              filename: 'contexto.png',
              content_type: 'image/png',
              size: 1024,
              url: 'https://cdn.discordapp.com/attachments/1/2/contexto.png',
            },
          },
        },
      },
    } as unknown as DiscordInteraction;

    expect(parseTicketAttachments(interaction)).toEqual([
      expect.objectContaining({ id: 'attachment-1', filename: 'contexto.png' }),
    ]);
  });

  it('valida custom ids de triage y de todos los estados', () => {
    expect(parseTriageId(`triage_platform_${publicId}`)).toBe(publicId);
    expect(parseStatusId(`status_RESUELTO_${publicId}`)).toEqual({
      status: 'RESUELTO',
      publicId,
    });
    expect(parseStatusId(`status_PENDIENTE_${publicId}`)).toEqual({
      status: 'PENDIENTE',
      publicId,
    });
    expect(parseStatusId(`status_EN_STAGING_${publicId}`)).toEqual({
      status: 'EN_STAGING',
      publicId,
    });
    expect(parseTriageId('triage_platform_drop table')).toBeNull();
  });
});
