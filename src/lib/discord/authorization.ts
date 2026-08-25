export function canTriage(roles: readonly string[], triagerRoleId: string) {
  return roles.includes(triagerRoleId);
}

export function canChangeTicketStatus(
  roles: readonly string[],
  triagerRoleId: string,
  platformRoleId: string | null,
) {
  return (
    roles.includes(triagerRoleId) ||
    (platformRoleId !== null && roles.includes(platformRoleId))
  );
}
