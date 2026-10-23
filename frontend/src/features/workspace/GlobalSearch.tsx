import { useMemo, useState, type ComponentType } from "react";
import {
  Building2,
  CornerDownLeft,
  FolderKanban,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { fold } from "../../model";

export type SearchKind = "screen" | "project" | "leader" | "team" | "person";
export type SearchItem = {
  kind: SearchKind;
  id: string;
  name: string;
  /** Second line: owner, leadership, responsible person. */
  detail?: string;
  Icon?: ComponentType<{ size?: number }>;
};

const GROUPS: { kind: SearchKind; label: string; Icon: SearchItem["Icon"] }[] =
  [
    { kind: "screen", label: "Ekranlar", Icon: undefined },
    { kind: "project", label: "Projeler", Icon: FolderKanban },
    { kind: "leader", label: "Liderlikler", Icon: Building2 },
    { kind: "team", label: "Takımlar", Icon: Users },
    { kind: "person", label: "Kişiler", Icon: UserRound },
  ];
/** Where a pick opens; read by the user before pressing Enter. */
const OPENS: Record<SearchKind, string> = {
  screen: "Ekranı aç",
  project: "Projeler'de göster",
  leader: "Kaynak Planlama'da göster",
  team: "Kaynak Planlama'da göster",
  person: "Aktivite Giriş'te göster",
};
const PER_GROUP = 6;

/** Ctrl+K: one box for screens, projects, leaderships, teams and people the
 * user may open. Accent and case insensitive (fold), keyboard driven. */
export default function GlobalSearch({
  open,
  onOpenChange,
  items,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SearchItem[];
  onPick: (item: SearchItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const groups = useMemo(() => {
    const needle = fold(query.trim());
    return GROUPS.map((group) => ({
      ...group,
      items: items
        .filter(
          (item) =>
            item.kind === group.kind &&
            (needle
              ? fold(item.name + " " + (item.detail || "")).includes(needle)
              : item.kind === "screen"),
        )
        .slice(0, PER_GROUP),
    })).filter((group) => group.items.length);
  }, [items, query]);
  const flat = groups.flatMap((group) => group.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));
  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setQuery("");
      setActive(0);
    }
  }
  function pick(item: SearchItem) {
    close(false);
    onPick(item);
  }
  let index = -1;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={close}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="global-search-overlay" />
        <DialogPrimitive.Content
          className="global-search"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Genel arama
          </DialogPrimitive.Title>
          <div className="global-search-box">
            <Search size={17} aria-hidden="true" />
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls="global-search-results"
              aria-activedescendant={
                flat[current] ? "global-search-" + current : undefined
              }
              aria-label="Ekran, proje, liderlik, takım veya kişi ara"
              placeholder="Ekran, proje, liderlik, takım veya kişi ara…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((current + 1) % Math.max(1, flat.length));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive(
                    (current - 1 + flat.length) % Math.max(1, flat.length),
                  );
                } else if (event.key === "Enter" && flat[current]) {
                  event.preventDefault();
                  pick(flat[current]);
                }
              }}
            />
            <kbd>Esc</kbd>
          </div>
          <div
            id="global-search-results"
            role="listbox"
            aria-label="Arama sonuçları"
            className="global-search-results"
          >
            {groups.map((group) => (
              <div key={group.kind} role="group" aria-label={group.label}>
                <div className="global-search-group" aria-hidden="true">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  index++;
                  const position = index;
                  const Icon = item.Icon || group.Icon || Search;
                  return (
                    <div
                      key={item.kind + ":" + item.id}
                      id={"global-search-" + position}
                      role="option"
                      aria-selected={position === current}
                      className="global-search-item"
                      onMouseMove={() => setActive(position)}
                      onClick={() => pick(item)}
                    >
                      <Icon size={16} />
                      <span>
                        <strong>{item.name}</strong>
                        {item.detail && <small>{item.detail}</small>}
                      </span>
                      {position === current && (
                        <em>
                          {OPENS[item.kind]}
                          <CornerDownLeft size={13} aria-hidden="true" />
                        </em>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {!flat.length && (
              <p className="global-search-empty">
                “{query.trim()}” için sonuç yok.
              </p>
            )}
          </div>
          <div className="global-search-hint" aria-hidden="true">
            ↑ ↓ gezin · Enter aç · Esc kapat
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
