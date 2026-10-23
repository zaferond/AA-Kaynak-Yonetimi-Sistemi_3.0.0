// Notifications: recent changes by other people, read from the audit log and
// cut to what the reader may already see. Only a short summary derived from
// the changed field names leaves the server; field values never do.

/** Kinds worth telling people about. Cell-level planning/actual entries,
 * people, calendars and accounts are left out (noise or personal data). */
export const NOTIFICATION_KINDS = [
  "project",
  "progress",
  "progressLock",
  "risk",
  "scenario",
];
const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
const monthText = (month) => {
  const [year, m] = String(month).split("-");
  const name = MONTHS[Number(m) - 1];
  return name ? `${name} ${year}` : String(month);
};
const paths = (changes) => {
  try {
    const list = JSON.parse(changes);
    return Array.isArray(list)
      ? list.filter((c) => Array.isArray(c?.path)).map((c) => c)
      : [];
  } catch {
    return [];
  }
};

/** A sentence about the change, from field names (and a status word). */
export function notificationSummary({ kind, action, record_id, changes }) {
  const list = paths(changes);
  const touched = (key) => list.some((c) => c.path[0] === key);
  if (kind === "progressLock")
    return (
      monthText(record_id) +
      (action === "delete" ? " kilidi açıldı" : " kilitlendi")
    );
  if (kind === "project") {
    if (action === "create") return "Yeni proje eklendi";
    if (action === "delete") return "Proje silindi";
    if (touched("milestones"))
      return "Kilometre taşı veya kritik konu güncellendi";
    if (touched("phases") || touched("phaseColors"))
      return "Aşamalar güncellendi";
    if (touched("start") || touched("end")) return "Proje tarihleri değişti";
    return "Proje bilgileri güncellendi";
  }
  if (kind === "progress") {
    const status = list.find(
      (c) => c.path[0] === "proposal" && c.path[1] === "status",
    )?.after;
    if (touched("baselines")) return "Hedef plan onaylandı";
    if (status === "pending") return "Hedef plan onaya gönderildi";
    if (status === "draft") return "Hedef plan onaydan geri çekildi";
    const month = list.find((c) => c.path[0] === "actuals")?.path[1];
    if (month) return monthText(month) + " gerçekleşeni girildi";
    if (action === "create") return "Hedef plan girişi başladı";
    return "Hedef plan taslağı güncellendi";
  }
  if (kind === "risk") {
    if (action === "create") return "Yeni risk eklendi";
    if (action === "delete") return "Risk silindi";
    if (touched("status")) return "Risk durumu değişti";
    return "Risk güncellendi";
  }
  if (kind === "scenario") {
    if (action === "create") return "Yeni senaryo kaydedildi";
    if (action === "delete") return "Senaryo silindi";
    return "Senaryo güncellendi";
  }
  return "Kayıt güncellendi";
}

const TABS = {
  project: "projects",
  progress: "progress",
  progressLock: "progress",
  risk: "risk",
  scenario: "projects",
};

/**
 * Rows the reader may see: the record must be in the reader's own scoped
 * snapshot (`data` comes from Store.view), so projects, risks, scenarios and
 * progress records outside it never appear. Month locks concern the roles
 * with the Değerlendirme screen (admins and managers; see scopeData).
 */
export function buildNotifications(rows, data, role, limit) {
  const ids = (list) => new Set((list || []).map((item) => item.id));
  const visible = {
    project: ids(data.projects),
    progress: ids(data.projectProgress),
    risk: ids(data.risks),
    scenario: ids(data.scheduleScenarios),
  };
  const seesProgress = role === "admin" || role === "manager";
  const out = [];
  for (const row of rows) {
    if (!NOTIFICATION_KINDS.includes(row.kind)) continue;
    const allowed =
      row.kind === "progressLock"
        ? seesProgress
        : visible[row.kind]?.has(row.record_id);
    if (!allowed) continue;
    const summary = notificationSummary(row);
    const last = out[out.length - 1];
    // Consecutive saves of the same record by the same person read as one.
    if (
      last &&
      last.kind === row.kind &&
      last.recordId === row.record_id &&
      last.actor === row.actor_name &&
      last.summary === summary
    ) {
      last.count++;
      continue;
    }
    if (out.length >= limit) break;
    out.push({
      id: row.id,
      at: row.occurred_at,
      actor: row.actor_name,
      kind: row.kind,
      record: row.kind === "progressLock" ? "" : row.record_name,
      summary,
      tab: TABS[row.kind],
      count: 1,
      recordId: row.record_id,
    });
  }
  return out.map(({ recordId, ...item }) => item);
}
