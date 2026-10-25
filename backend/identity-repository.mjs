import { SESSION_IDLE_MS } from "./session-policy.mjs";
// SQL mapping only. The caller owns the connection and transaction.
const mapUser = (r) =>
  r && {
    _id: r.id,
    username: r.username,
    name: r.name,
    role: r.role,
    resourceId: r.resource_id || "",
    authSource: r.auth_source || "local",
    directoryId: r.directory_id || "",
    email: r.email || "",
    active: !!r.active,
    // "Normal-Proje": a normal account with admin rights on project screens.
    ...(r.role === "normal" && Number(r.project_editor) === 1
      ? { projectEditor: true }
      : {}),
    // A password someone else knows (.env bootstrap or reset) must be replaced.
    ...(Number(r.must_change_password) === 1
      ? { mustChangePassword: true }
      : {}),
    // Screen opened after sign-in; empty means Ana Sayfa.
    ...(r.default_tab ? { defaultTab: r.default_tab } : {}),
    leaders: [],
    planningTeams: [],
    password: { salt: r.password_salt, hash: r.password_hash },
    revision: Number(r.revision),
    version: Number(r.version),
  };
export async function readUsers(c) {
  const users = (
    await c.query("SELECT * FROM kp_users ORDER BY username")
  ).rows.map(mapUser);
  const map = new Map(users.map((u) => [u._id, u]));
  for (const r of (
    await c.query("SELECT * FROM kp_user_leaders ORDER BY leader_name")
  ).rows)
    map.get(r.user_id)?.leaders.push(r.leader_name);
  for (const r of (
    await c.query("SELECT * FROM kp_user_planning_teams ORDER BY team_id")
  ).rows)
    map.get(r.user_id)?.planningTeams.push(r.team_id);
  return users;
}
export async function findUser(c, filter) {
  const col =
    filter.id !== undefined
      ? "id"
      : filter.directoryId !== undefined
        ? "directory_id"
        : "username";
  const r = (
    await c.query(`SELECT * FROM kp_users WHERE [${col}]=@p0`, [
      filter.id ?? filter.directoryId ?? filter.username,
    ])
  ).rows[0];
  if (!r) return null;
  const u = mapUser(r);
  u.leaders = (
    await c.query(
      "SELECT leader_name FROM kp_user_leaders WHERE user_id=@p0 ORDER BY leader_name",
      [u._id],
    )
  ).rows.map((x) => x.leader_name);
  u.planningTeams = (
    await c.query(
      "SELECT team_id FROM kp_user_planning_teams WHERE user_id=@p0 ORDER BY team_id",
      [u._id],
    )
  ).rows.map((x) => x.team_id);
  return u;
}
export async function saveUser(c, u) {
  await c.upsert("users", [
    {
      id: u._id,
      username: u.username,
      name: u.name,
      role: u.role,
      resource_id: u.resourceId || null,
      auth_source: u.authSource || "local",
      directory_id: u.directoryId || null,
      email: u.email || "",
      active: u.active,
      project_editor: u.role === "normal" && u.projectEditor ? 1 : 0,
      must_change_password: u.mustChangePassword ? 1 : 0,
      default_tab: u.defaultTab || null,
      password_salt: u.password.salt,
      password_hash: u.password.hash,
      revision: u.revision,
      version: u.version,
    },
  ]);
  await c.query("DELETE FROM kp_user_leaders WHERE user_id=@p0", [u._id]);
  await c.upsert(
    "user_leaders",
    [...new Set(u.leaders)].map((leader_name) => ({
      user_id: u._id,
      leader_name,
    })),
  );
  await c.query("DELETE FROM kp_user_planning_teams WHERE user_id=@p0", [
    u._id,
  ]);
  await c.upsert(
    "user_planning_teams",
    [...new Set(u.planningTeams || [])].map((team_id) => ({
      user_id: u._id,
      team_id,
    })),
  );
}
export async function deleteUser(c, id, revision) {
  return (
    await c.query("DELETE FROM kp_users WHERE id=@p0 AND revision=@p1", [
      id,
      revision,
    ])
  ).rowCount;
}
export async function readSession(c, id) {
  const r = (
    await c.query(
      "SELECT * FROM kp_sessions WHERE token_hash=@p0 AND expires_at>@p1 AND last_activity_at>@p2",
      [
        id,
        new Date().toISOString(),
        new Date(Date.now() - SESSION_IDLE_MS).toISOString(),
      ],
    )
  ).rows[0];
  return (
    r && {
      _id: r.token_hash,
      userId: r.user_id,
      userVersion: Number(r.user_version),
      csrf: r.csrf,
      expiresAt: new Date(r.expires_at),
      lastActivityAt: new Date(r.last_activity_at),
    }
  );
}
export const createSession = (c, s) =>
  c.upsert("sessions", [
    {
      token_hash: s._id,
      user_id: s.userId,
      user_version: s.userVersion,
      csrf: s.csrf,
      expires_at: s.expiresAt.toISOString(),
      last_activity_at: (s.lastActivityAt || new Date()).toISOString(),
    },
  ]);
export const deleteSession = (c, id) =>
  c.query("DELETE FROM kp_sessions WHERE token_hash=@p0", [id]);
export const revokeUserSessions = (c, id) =>
  c.query("DELETE FROM kp_sessions WHERE user_id=@p0", [id]);
export const cleanupSessions = (c) =>
  c.query(
    "DELETE FROM kp_sessions WHERE expires_at<=@p0 OR last_activity_at<=@p1 OR last_activity_at IS NULL",
    [
      new Date().toISOString(),
      new Date(Date.now() - SESSION_IDLE_MS).toISOString(),
    ],
  );

/** The account's opening screen. A preference only: no revision or session
 * change, so it never conflicts with an admin's edit of the account. */
export async function saveDefaultTab(c, id, tab) {
  await c.query("UPDATE kp_users SET default_tab=@p0 WHERE id=@p1", [
    tab || null,
    id,
  ]);
}

export async function touchSession(c, id) {
  const now = new Date().toISOString();
  return (
    await c.query(
      "UPDATE kp_sessions SET last_activity_at=CASE WHEN last_activity_at<@p0 THEN @p0 ELSE last_activity_at END WHERE token_hash=@p1 AND expires_at>@p0 AND last_activity_at>@p2",
      [now, id, new Date(Date.now() - SESSION_IDLE_MS).toISOString()],
    )
  ).rowCount;
}
