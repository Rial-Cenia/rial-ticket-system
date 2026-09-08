import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppUser, Kanban, Team } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  fetchUsers: vi.fn(),
  fetchTeams: vi.fn(),
  fetchKanbans: vi.fn(),
  updateUserRole: vi.fn(),
  updateTeamMember: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@/lib/api/kanbans', () => ({
  fetchUsers: mocks.fetchUsers,
  fetchTeams: mocks.fetchTeams,
  fetchKanbans: mocks.fetchKanbans,
  updateUserRole: mocks.updateUserRole,
  updateTeamMember: mocks.updateTeamMember,
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import { SettingsPage } from '@/components/settings/settings-page';

const users: AppUser[] = [
  {
    userId: 'user-1',
    email: 'ana@rial.cl',
    name: 'Ana',
    role: 'USER',
  },
  {
    userId: 'user-2',
    email: 'bea@rial.cl',
    name: 'Bea',
    role: 'ADMIN',
  },
];

const teams: Team[] = [
  {
    id: 'team-1',
    name: 'Producto',
    members: [
      {
        ...users[0],
        membershipId: 'membership-1',
        membershipRole: 'MEMBER',
      },
    ],
    canManage: true,
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T10:00:00.000Z',
  },
];

const kanbans: Kanban[] = [];

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <SettingsPage currentRole="ADMIN" />
    </QueryClientProvider>,
  );
}

describe('SettingsPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchUsers.mockResolvedValue(users);
    mocks.fetchTeams.mockResolvedValue(teams);
    mocks.fetchKanbans.mockResolvedValue(kanbans);
    mocks.updateUserRole.mockResolvedValue({});
    mocks.updateTeamMember.mockResolvedValue({});
  });

  it('guarda cambios de rol global solo al confirmar', async () => {
    renderSettings();

    await screen.findByRole('heading', { name: 'Configuración' });
    await userEvent.selectOptions(
      screen.getByLabelText('Rol global de Ana'),
      'ADMIN',
    );

    expect(mocks.updateUserRole).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Guardar' })[0],
    );

    await waitFor(() =>
      expect(mocks.updateUserRole).toHaveBeenCalledWith('user-1', 'ADMIN'),
    );
    expect(mocks.showToast).toHaveBeenCalledWith({
      variant: 'success',
      message: 'Rol actualizado correctamente.',
    });
  });

  it('guarda cambios de rol de equipo solo al confirmar', async () => {
    renderSettings();

    await screen.findByRole('heading', { name: 'Configuración' });
    await userEvent.selectOptions(
      screen.getByLabelText('Rol de equipo de Ana'),
      'LEADER',
    );

    expect(mocks.updateTeamMember).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar rol' }));

    await waitFor(() =>
      expect(mocks.updateTeamMember).toHaveBeenCalledWith(
        'team-1',
        'membership-1',
        'LEADER',
      ),
    );
    expect(mocks.showToast).toHaveBeenCalledWith({
      variant: 'success',
      message: 'Rol del equipo actualizado correctamente.',
    });
  });
});
