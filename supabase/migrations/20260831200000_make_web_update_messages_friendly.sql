create or replace function public.update_ticket(
  p_public_id uuid,
  p_patch jsonb,
  p_source public."ActivitySource",
  p_actor_name text,
  p_actor_id text default null
)
returns public."Ticket"
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous public."Ticket";
  changed public."Ticket";
  actor text := left(replace(p_actor_name, '@', '@' || chr(8203)), 4000);
  code text;
  content text;
begin
  if p_patch = '{}'::jsonb or p_patch ?| array['publicId', 'id', 'createdByName', 'createdByDiscordId', 'discordThreadId', 'createdAt', 'updatedAt'] then
    raise exception 'Invalid ticket patch';
  end if;

  select * into previous from public."Ticket" where "publicId" = p_public_id for update;
  if not found then raise exception 'Ticket not found'; end if;

  update public."Ticket"
  set
    title = case when p_patch ? 'title' then p_patch->>'title' else title end,
    description = case when p_patch ? 'description' then p_patch->>'description' else description end,
    type = case when p_patch ? 'type' then (p_patch->>'type')::public."TicketType" else type end,
    priority = case when p_patch ? 'priority' then (p_patch->>'priority')::public."TicketPriority" else priority end,
    status = case when p_patch ? 'status' then (p_patch->>'status')::public."TicketStatus" else status end,
    platform = case when p_patch ? 'platform' then nullif(p_patch->>'platform', '')::public."Platform" else platform end
  where "publicId" = p_public_id
  returning * into changed;

  insert into public."TicketActivity" ("ticketPublicId", source, action, "actorName", "actorId", changes)
  values (
    p_public_id,
    p_source,
    'UPDATED',
    p_actor_name,
    p_actor_id,
    jsonb_build_object('before', to_jsonb(previous), 'after', to_jsonb(changed), 'patch', p_patch)
  );

  if p_source = 'WEB' and changed."discordThreadId" is not null then
    code := format('RTP-%s', changed.id);
    if previous.status is distinct from changed.status then
      content := case changed.status
        when 'EN_PROGRESO' then format('🔄 **¡Tenemos movimiento en el Kanban!** 🛹✨%s**%s** actualizó el ticket `%s` y ahora está **EN PROGRESO** 🚧%sLa quest ha comenzado, besties. Alguien ya se puso la 10 y está cocinando una solución, uwu 🍳🔥', E'\n', actor, code, E'\n')
        when 'PENDIENTE' then format('⏳ **Mini pausa administrativa** (｡•́︿•̀｡)%sEl ticket `%s` fue actualizado por **%s** y quedó **PENDIENTE** 🎀%sTodavía no entra al horno, pero ya está haciendo fila educadamente. Paciencia, bestie: su momento slay llegará 🧍✨', E'\n', code, actor, E'\n')
        when 'EN_STAGING' then format('🧪 **¡Entramos en la era de las pruebibas!** ✨%s**%s** movió el ticket `%s` a **EN STAGING** 🧑‍🔬🎀%sLa solución ya está en su ensayo general: probando el outfit antes de salir a producción 💃🏻%sManifestando cero bugs, uwu 🕯️ʕ•́ᴥ•̀ʔっ', E'\n', actor, code, E'\n', E'\n')
        when 'RESUELTO' then format('🎉 **¡Caso cerrado, criaturas!** 🎉%sEl ticket `%s` fue marcado como **RESUELTO** por **%s** ✅💖%sEl problema fue derrotado, la paz regresó al reino y el team sirvió desarrollo con éxito 💅🏻✨%sCommon support W, besties ʕっ•ᴥ•ʔっ♡', E'\n', code, actor, E'\n', E'\n')
        when 'EN_ESPERA' then format('🛑 **El ticket entró en modo “ahí te aviso”** 🧍🏻‍♀️💭%s**%s** cambió el estado de `%s` a **EN ESPERA** ⏸️🎀%sPor ahora toca hacer una pausita dramática y aguardar novedades…%sNo está olvidado, solo está teniendo su training arc, uwu 🌸✨', E'\n', actor, code, E'\n', E'\n')
      end;
    else
      content := format('✨ **¡El ticket recibió un glow-up!** ✨%s**%s** actualizó el ticket `%s` desde la web 🎀', E'\n', actor, code);
      if previous.title is distinct from changed.title then
        content := content || E'\n📝 El titulito quedó actualizado, bestie.';
      end if;
      if previous.description is distinct from changed.description then
        content := content || E'\n💬 El chismecito recibió nuevos detalles.';
      end if;
      if previous.type is distinct from changed.type then
        content := content || format(E'\n🧩 Tipo de dramita: **%s**.', case changed.type
          when 'REQUERIMIENTO' then '📋 Nueva petición'
          when 'MEJORA' then '✨ Mejora con glow-up'
          when 'DUDA' then '💭 Dudita existencial'
          when 'BUG' then '🐛 Bug travieso'
        end);
      end if;
      if previous.priority is distinct from changed.priority then
        content := content || format(E'\n🚦 Nivel de fueguito: **%s**.', case changed.priority
          when 'BAJA' then '🌱 Suavecito, puede esperar'
          when 'MEDIA' then '✨ Importante, pero respiramos'
          when 'ALTA' then '🔥 Ojo aquí, urge prontito'
          when 'CRITICA' then '🚨 Todo arde, ayuda ya'
        end);
      end if;
      if previous.platform is distinct from changed.platform then
        content := content || format(E'\n🖥️ Plataforma: **%s**.', coalesce(case changed.platform
          when 'NESTOR' then '🌸 Nestor'
          when 'DYLAN' then '⭐ Dylan'
          when 'ATOM' then '⚛️ Atom'
          when 'KAYS' then '🎀 Kays'
          when 'EXTERNO' then '🌍 Externo'
        end, 'Sin asignar'));
      end if;
    end if;

    insert into public."TicketSyncOutbox" ("ticketPublicId", type, payload)
    values (
      p_public_id,
      'SEND_THREAD_MESSAGE',
      jsonb_build_object('threadId', changed."discordThreadId", 'content', content)
    );
  end if;

  return changed;
end;
$$;
