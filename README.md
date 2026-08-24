# Ticketera Rial

Aplicación independiente de tickets construida con Next.js App Router, Supabase y la API oficial de Discord Interactions. Supabase es la fuente de verdad; la web recibe cambios por Realtime y las operaciones hacia Discord usan un outbox reintentable.

## Requisitos

- Node.js 20 o superior
- Corepack y Yarn 4.9.1
- Docker para ejecutar Supabase local
- Un proyecto de Supabase y una aplicación/bot de Discord para entornos reales

## Inicio local

```bash
corepack enable
yarn install
cp .env.example .env.local
yarn supabase start
yarn supabase db reset
yarn dev
```

Supabase muestra las credenciales locales al iniciar. Copia la URL, publishable/anon key y service role key a `.env.local`. La aplicación queda disponible en `http://localhost:3000`.

No existe registro público. Crea las cuentas de email/contraseña previamente desde Supabase Auth. Google OAuth admite únicamente los dominios separados por coma configurados en `AUTH_ALLOWED_GOOGLE_DOMAINS`.

## Variables de entorno

| Variable                                          | Uso                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                        | URL del proyecto Supabase                                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`            | Clave pública moderna; puede reemplazarse por`NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SUPABASE_SECRET_KEY`                             | Clave servidor moderna; puede reemplazarse por`SUPABASE_SERVICE_ROLE_KEY`    |
| `AUTH_ALLOWED_GOOGLE_DOMAINS`                     | Dominios Google autorizados, separados por coma                              |
| `APP_URL`                                         | URL pública de la aplicación                                                 |
| `CRON_SECRET`                                     | Secreto Bearer del dispatcher                                                |
| `DISCORD_PUBLIC_KEY`                              | Clave pública Ed25519 de la aplicación Discord                               |
| `DISCORD_CLIENT_ID`                               | Client ID OAuth2 de la aplicación Discord                                    |
| `DISCORD_CLIENT_SECRET`                           | Client secret OAuth2; solo servidor                                          |
| `DISCORD_BOT_TOKEN`                               | Token del bot                                                                |
| `DISCORD_GUILD_ID`                                | Servidor autorizado                                                          |
| `DISCORD_TRIAGE_CHANNEL_ID`                       | Canal de texto donde viven el panel y los threads                            |
| `DISCORD_TRIAGER_ROLE_ID`                         | Rol Barbilla Roja                                                            |
| `DISCORD_NESTOR_ROLE_ID` … `DISCORD_KAYS_ROLE_ID` | Roles responsables de cada plataforma                                        |
| `DISCORD_PANEL_MESSAGE_ID`                        | Opcional; permite actualizar el panel ya publicado                           |

Las claves servidor, el token del bot y `CRON_SECRET` nunca deben llevar el prefijo `NEXT_PUBLIC_` ni almacenarse en Git.

## Base de datos

La migración en `supabase/migrations/` crea enums, `Ticket`, `TicketActivity`, `TicketSyncOutbox` y `DiscordInteraction`; configura índices, trigger de `updatedAt`, RLS, grants, RPCs atómicas y la publicación Realtime. El seed local está en `supabase/seed.sql`.

Para validar desde cero:

```bash
yarn supabase db reset
yarn test:db
```

Las APIs del servidor llaman RPCs con la clave servidor. El navegador solo puede leer tickets y actividades como usuario autenticado; no puede mutar tablas ni acceder al outbox o a la deduplicación de Discord.

## Configuración de Discord

1. Crea una aplicación en Discord Developer Portal y añade su bot al servidor indicado por `DISCORD_GUILD_ID`.
2. Otorga en el canal de triage: `View Channel`, `Send Messages`, `Send Messages in Threads`, `Create Public Threads`, `Manage Threads` y `Read Message History`.
3. En **General Information → Interactions Endpoint URL**, configura `https://<dominio>/api/discord`. Discord enviará un PING firmado que el endpoint valida con `DISCORD_PUBLIC_KEY`.
4. Configura en Vercel todas las variables Discord y Supabase antes de validar el endpoint.
5. Publica el panel una sola vez con `yarn discord:setup`. Si ya existe, guarda su ID en `DISCORD_PANEL_MESSAGE_ID` y ejecuta el mismo comando para actualizarlo.
6. En **OAuth2 → Redirects**, registra exactamente `<APP_URL>/api/discord/oauth/callback`.
7. Otorga al bot `Manage Roles` y ubica su rol por encima de Barbilla Roja para poder administrar sus miembros desde la plataforma.

Cada usuario interno puede abrir **Discord → Vincular mi Discord**. La autorización solicita únicamente `identify` y `guilds.members.read`, verifica que la cuenta pertenezca al servidor configurado y luego descarta el access token. La plataforma guarda solo la identidad pública enlazada. Desde esa misma pantalla, una cuenta autenticada puede asignar o quitar el rol Barbilla Roja a usuarios que ya vincularon Discord.

El bot limita las menciones a IDs de rol configurados y al usuario de Discord que creó cada ticket. No requiere `Mention Everyone`. Cada ticket usa un código correlativo `RTP-{n}` y su thread se llama `RTP-{n}: {título}`. El panel abre un modal con título, descripción y tipo. Barbilla Roja hace triage y luego Barbilla Roja o el rol de la plataforma pueden cambiar el estado con botones; cada actualización menciona al creador cuando el ticket nació en Discord.

## Outbox, Cron y Vault

`POST /api/discord/jobs` reclama jobs con `SKIP LOCKED` y exige:

```text
Authorization: Bearer <CRON_SECRET>
```

Procesa creación idempotente de threads, mensajes y archivado. Respeta `retry_after` de Discord, usa backoff exponencial para red/5xx, recupera locks expirados y envía errores 4xx permanentes o jobs con ocho intentos a `DEAD_LETTER`.

Después de desplegar, agrega manualmente en Supabase Vault:

- `ticket_app_url`: URL HTTPS de Vercel, sin slash final.
- `ticket_cron_secret`: el mismo valor de `CRON_SECRET` configurado en Vercel.

Luego ejecuta manualmente `supabase/cron-bootstrap.sql` en el SQL Editor del proyecto. Este paso crea el cron de un minuto con `pg_cron` y `pg_net`. No se debe versionar el valor de ningún secreto.

## Desarrollo y validación

```bash
yarn lint
yarn format:check
yarn typecheck
yarn test
yarn test:db
yarn test:e2e
yarn build
```

Las pruebas E2E arrancan Next localmente. El smoke test valida la pantalla de acceso. El flujo completo de creación, filtros, drag-and-drop, edición, tabla, detalle y eliminación se ejecuta al definir `E2E_EMAIL` y `E2E_PASSWORD` con una cuenta Supabase preaprovisionada.

## Despliegue

1. Crea el proyecto de Supabase y aplica las migraciones con el flujo aprobado del equipo.
2. Configura Google OAuth y los usuarios preaprovisionados.
3. Despliega esta carpeta como proyecto independiente de Vercel y carga sus variables de entorno.
4. Configura la URL de Interactions de Discord y publica el panel.
5. Agrega los secretos a Vault y aplica el bootstrap de Cron.

Este repositorio no aplica migraciones remotas, no publica el panel, no modifica Discord Developer Portal y no despliega en Vercel automáticamente.
