export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_WARNING_MS = 5 * 60 * 1000;
export function privilegedSession(user) {
  return (
    user.role === "admin" || user.role === "manager" || !!user.projectEditor
  );
}
export function sessionLifetime(user, remember) {
  return privilegedSession(user)
    ? 8 * 3600000
    : user.authSource === "ldap"
      ? 12 * 3600000
      : (remember ? 30 * 24 : 12) * 3600000;
}
export const idleDeadline = (session) =>
  Math.min(
    session.expiresAt.getTime(),
    (session.lastActivityAt?.getTime() ?? 0) + SESSION_IDLE_MS,
  );
