export function canAnalyzeWithCodex(
  roles: readonly string[],
  operatorRoleId: string,
) {
  return roles.includes(operatorRoleId);
}

export function canImplementWithCodex(
  roles: readonly string[],
  operatorRoleId: string,
) {
  return roles.includes(operatorRoleId);
}

export function canRespondToCodex(
  actorDiscordId: string,
  allowedDiscordIds: readonly string[],
) {
  return allowedDiscordIds.includes(actorDiscordId);
}
