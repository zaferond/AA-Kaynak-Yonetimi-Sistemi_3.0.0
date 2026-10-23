import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { readNotifications, type NotificationItem } from "../../storage";

const REFRESH_MS = 3 * 60_000;
const seenKey = (userId: string) => "aa.notificationsSeen:" + userId;
function readSeen(userId: string) {
  try {
    return localStorage.getItem(seenKey(userId)) || "";
  } catch {
    return "";
  }
}
const timeFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
function when(at: string) {
  const minutes = Math.round((Date.now() - Date.parse(at)) / 60_000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return minutes + " dk önce";
  if (minutes < 24 * 60) return Math.round(minutes / 60) + " sa önce";
  return timeFormat.format(new Date(at));
}

/** Bell in the top bar: others' recent changes the user may see. The newest
 * time the list was opened is kept in this browser; later items count as new. */
export default function NotificationBell({
  userId,
  onOpen,
}: {
  userId: string;
  onOpen: (tab: string) => void;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [seen, setSeen] = useState(() => readSeen(userId));
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    readNotifications()
      .then((list) => {
        setItems(list);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);
  const unread = items.filter((item) => item.at > seen).length;
  function toggle(next: boolean) {
    setOpen(next);
    if (next) load();
    else if (items[0] && items[0].at > seen) {
      // Closing marks everything that was listed as read.
      setSeen(items[0].at);
      try {
        localStorage.setItem(seenKey(userId), items[0].at);
      } catch {
        // Without storage the badge simply returns next visit.
      }
    }
  }
  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mast-bell"
          aria-label={unread ? `Bildirimler, ${unread} yeni` : "Bildirimler"}
        >
          <Bell size={16} aria-hidden="true" />
          {unread > 0 && (
            <span className="mast-bell-count" aria-hidden="true">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="notification-panel" align="end">
        <div className="notification-head">
          <strong>Bildirimler</strong>
          <small>Kapsamınızdaki son değişiklikler</small>
        </div>
        {failed && !items.length ? (
          <p className="notification-empty">Bildirimler yüklenemedi.</p>
        ) : !items.length ? (
          <p className="notification-empty">Henüz bildirim yok.</p>
        ) : (
          <ul className="notification-list">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  data-unread={item.at > seen || undefined}
                  onClick={() => {
                    toggle(false);
                    onOpen(item.tab);
                  }}
                >
                  <span className="notification-summary">{item.summary}</span>
                  {item.record && (
                    <span className="notification-record">{item.record}</span>
                  )}
                  <small>
                    {item.actor} · {when(item.at)}
                    {item.count > 1 ? ` · ${item.count} değişiklik` : ""}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
