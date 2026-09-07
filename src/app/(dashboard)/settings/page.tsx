import { redirect } from 'next/navigation';
import { SettingsPage } from '@/components/settings/settings-page';
import { getAuthenticatedUser } from '@/lib/auth';
import { getLeaderTeamIds } from '@/lib/kanbans/authorization';

export default async function SettingsRoute() {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/login');
  const leaderTeamIds = await getLeaderTeamIds(user);
  if (leaderTeamIds !== null && leaderTeamIds.length === 0)
    redirect('/tasks/kanban');
  return <SettingsPage currentRole={user.role} />;
}
