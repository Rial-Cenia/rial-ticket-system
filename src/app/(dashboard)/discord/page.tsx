import { DiscordAccountsPanel } from '@/components/discord/discord-accounts-panel';
import { getAuthenticatedUser } from '@/lib/auth';
import { listDiscordLinkedUsers } from '@/lib/discord/accounts';

interface Props {
  searchParams: Promise<{ linked?: string; error?: string }>;
}

export default async function DiscordPage({ searchParams }: Props) {
  const user = await getAuthenticatedUser();
  const [status, users] = await Promise.all([
    searchParams,
    listDiscordLinkedUsers(),
  ]);

  return (
    <DiscordAccountsPanel
      currentUserId={user?.id ?? ''}
      initialStatus={status}
      initialUsers={users}
    />
  );
}
