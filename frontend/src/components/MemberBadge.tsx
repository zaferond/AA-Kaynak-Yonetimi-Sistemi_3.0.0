import { useEffect, useId, useRef, useState } from "react";
import { badgeAttrs, type BadgeTone } from "./Badge";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { monthLabel } from "../format";
export default function MemberBadge({
  label,
  members,
  currentMonth,
  heading = "Aktif Çalışanlar",
  noun = "aktif çalışan",
  tone = "neutral",
}: {
  label: string;
  members: string[];
  currentMonth: string;
  /** The list's title, before the month. */
  heading?: string;
  /** What the count counts, for the accessible name. */
  noun?: string;
  tone?: BadgeTone;
}) {
  const [open, setOpen] = useState(false);
  const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const headingId = useId();
  const keepOpen = () => {
    clearTimeout(closing.current);
    setOpen(true);
  };
  const closeSoon = () => {
    clearTimeout(closing.current);
    closing.current = setTimeout(() => setOpen(false), 180);
  };
  useEffect(() => () => clearTimeout(closing.current), []);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          {...badgeAttrs(tone, "count", "team-member-badge")}
          aria-label={label + " · " + members.length + " " + noun}
          onPointerEnter={keepOpen}
          onPointerLeave={closeSoon}
          onFocus={keepOpen}
          onBlur={closeSoon}
          onClick={(e) => {
            e.preventDefault();
            keepOpen();
          }}
        >
          {members.length}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="team-member-tooltip team-member-floating"
        role="tooltip"
        aria-labelledby={headingId}
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={keepOpen}
        onPointerLeave={closeSoon}
        onFocus={keepOpen}
        onBlur={closeSoon}
        onClick={(e) => {
          e.preventDefault();
          keepOpen();
        }}
      >
        <strong id={headingId}>
          {heading} · {monthLabel(currentMonth)}
        </strong>
        <div
          className="team-member-names"
          tabIndex={0}
          aria-label={label + " çalışan listesi"}
        >
          {members.length ? (
            members.map((name, index) => <span key={index}>{name}</span>)
          ) : (
            <span>Bu ay {noun} yok.</span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
