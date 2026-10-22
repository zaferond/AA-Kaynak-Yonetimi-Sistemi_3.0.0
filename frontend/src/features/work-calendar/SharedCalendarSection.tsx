import { Trash2 } from "lucide-react";
import { CALENDAR_DAY_TYPES as types } from "../calendar-commands";
import type { WorkCalendarEditor } from "./useWorkCalendarEditor";
import type { WorkCalendarView } from "./useWorkCalendarView";
import { formatCalendarRange } from "./format";

/** Official holidays are built in, so the shared calendar is read-only;
 * older manually entered dates stay listed only so they can be removed. */
export default function SharedCalendarSection({
  official,
  entries,
  canEdit,
  busy,
  removeDate,
}: {
  official: WorkCalendarView["officialEntries"];
  entries: WorkCalendarView["entries"];
  canEdit: boolean;
  busy: boolean;
  removeDate: WorkCalendarEditor["removeDate"];
}) {
  const details = (range: WorkCalendarView["entries"][number]) => (
    <>
      <span className="work-calendar-range-dates">
        {formatCalendarRange(range.from, range.to)}
        <small>
          {range.keys.length > 1
            ? range.keys.length + " takvim günü"
            : new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(
                new Date(range.from + "T12:00:00"),
              )}
        </small>
      </span>
      <span>
        {range.entry.label}
        <small>
          {types.find((type) => type.id === range.entry.type)?.label} ·{" "}
          {range.entry.fraction === 0.5 ? "Yarım gün" : "Tam gün"}
        </small>
      </span>
    </>
  );
  return (
    <>
      <div className="work-calendar-list work-calendar-official">
        <h3>Resmi Tatiller</h3>
        <p className="work-calendar-note">
          Resmi ve dini bayramlar sistemde tanımlıdır; saat hesapları bu
          tarihlere göre otomatik yapılır.
        </p>
        {official.length ? (
          <ul>
            {official.map((range) => (
              <li key={range.keys[0]} className="work-calendar-range-row">
                {details(range)}
              </li>
            ))}
          </ul>
        ) : (
          <p>Bu yıl için resmi tatil bilgisi tanımlı değil.</p>
        )}
      </div>
      {entries.length > 0 && (
        <div className="work-calendar-list">
          <h3>Elle Girilmiş Tarihler</h3>
          <ul>
            {entries.map((range) => {
              const name = `${range.from} – ${range.to} çalışma dışı tarih aralığını`;
              return (
                <li key={range.keys[0]} className="work-calendar-range-row">
                  {details(range)}
                  {canEdit && (
                    <div className="work-calendar-range-actions">
                      <button
                        type="button"
                        disabled={busy}
                        className="danger"
                        aria-label={name + " sil"}
                        title="Aralığın tamamını sil"
                        onClick={() => removeDate(range)}
                      >
                        <Trash2 size={14} />
                        Sil
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
