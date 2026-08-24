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
    })
    .passthrough()
    .optional(),
});

export type DiscordInteraction = z.infer<typeof discordInteractionSchema>;

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
