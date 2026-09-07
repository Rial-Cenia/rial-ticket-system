import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { getAuthenticatedUser } from '@/lib/auth';
import { getLeaderTeamIds } from '@/lib/kanbans/authorization';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/login');
  const leaderTeamIds = await getLeaderTeamIds(user);
  return (
    <DashboardShell
      userName={user.name}
      userRole={user.role}
      canConfigure={leaderTeamIds === null || leaderTeamIds.length > 0}
    >
      {children}
    </DashboardShell>
  );
}
