import { z } from 'zod';

const discordUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  global_name: z.string().nullable().optional(),
});

const discordMemberSchema = z.object({
  roles: z.array(z.string()).default([]),
  nick: z.string().nullable().optional(),
  user: discordUserSchema,
});

const discordAttachmentSchema = z.object({
  id: z.string(),
  filename: z.string().min(1).max(255),
  content_type: z.string().optional(),
  size: z.number().int().positive(),
  url: z.string().url(),
  proxy_url: z.string().url().optional(),
});

export const discordInteractionSchema = z.object({
  id: z.string(),
  application_id: z.string(),
  type: z.number().int(),
  token: z.string(),
  guild_id: z.string().optional(),
  channel_id: z.string().optional(),
  member: discordMemberSchema.optional(),
  user: discordUserSchema.optional(),
  data: z
    .object({
      custom_id: z.string().optional(),
      component_type: z.number().int().optional(),
      values: z.array(z.string()).optional(),
      components: z.array(z.unknown()).optional(),
      resolved: z
        .object({
          attachments: z.record(z.string(), discordAttachmentSchema).optional(),
        })
        .optional(),
    })
    .passthrough()
    .optional(),
});

export type DiscordInteraction = z.infer<typeof discordInteractionSchema>;
export type DiscordAttachment = z.infer<typeof discordAttachmentSchema>;

export interface DiscordMessagePayload {
  content?: string;
  embeds?: Array<Record<string, unknown>>;
  components?: Array<Record<string, unknown>>;
  allowed_mentions?: { parse?: string[]; roles?: string[]; users?: string[] };
  flags?: number;
}

export interface DiscordThread {
  id: string;
  name: string;
  parent_id?: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export interface DiscordGuildMember {
  roles: string[];
  nick?: string | null;
  user?: DiscordUser;
}
