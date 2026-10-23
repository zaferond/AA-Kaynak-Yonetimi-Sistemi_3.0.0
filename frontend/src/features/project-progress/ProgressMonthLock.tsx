import { Lock, LockOpen } from "lucide-react";
import Badge from "../../components/Badge";
import type { Data } from "../../model";
import type { Change } from "../../../../shared/commands";
import { monthName } from "../../format";

/** The selected month's lock: admins toggle it, leaders see when it is closed.
 * Shown in the same place on the Hedef Plan and Değerlendirme tabs. */
export default function ProgressMonthLock({
  data,
  month,
  admin,
  saving,
  onSave,
  onError,
}: {
  data: Data;
  month: string;
  admin: boolean;
  saving: boolean;
  onSave: (changes: Change[]) => Promise<void>;
  onError: (message: string) => void;
}) {
  const lock = (data.progressLocks || []).find((item) => item.id === month);

  async function toggleLock() {
    // Unlocking drops the month's evaluation and reopens its entries; a
    // second click on the same button must not do that silently.
    if (
      lock &&
      !window.confirm(
        `${monthName(month)} ayının kilidi açılsın mı? Ayın değerlendirmesi kaldırılır ve girişler yeniden değiştirilebilir.`,
      )
    )
      return;
    onError("");
    try {
      await onSave([
        {
          kind: "progressLock",
          id: month,
          value: lock ? null : { id: month, lockedByName: "", lockedAt: "" },
          revision: data.revisions["progressLock:" + month] || 0,
          ...(lock ? { operation: "delete" as const } : {}),
        },
      ]);
    } catch (cause) {
      onError((cause as Error).message);
    }
  }

  if (!admin)
    return lock ? (
      // Leaders cannot unlock; they still see that the month is closed.
      <Badge tone="warning" variant="status" className="progress-lock-state">
        {monthName(month)} Ayı Kilitli
      </Badge>
    ) : null;
  return (
    <button
      type="button"
      className="button progress-lock-button"
      // A locked month shows in the button's own colour.
      data-locked={lock ? "true" : "false"}
      aria-pressed={!!lock}
      disabled={saving}
      onClick={() => void toggleLock()}
    >
      {lock ? <Lock size={14} /> : <LockOpen size={14} />}
      {lock
        ? `${monthName(month)} Ayının Kilidini Aç`
        : `${monthName(month)} Ayını Kilitle`}
    </button>
  );
}
