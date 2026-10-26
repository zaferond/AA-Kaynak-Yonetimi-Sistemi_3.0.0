import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import "./date-field.css";
import FilterSelect from "./FilterSelect";

const months = [
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
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parse = (value: string) =>
  new Date(`${value.length === 7 ? value + "-01" : value}T12:00:00`);

/** Native editable value and validation, with a shared Turkish calendar popup. */
export default function DateField({
  type = "date",
  value,
  min,
  max,
  onChange,
  disabled,
  readOnly,
  rangeStart,
  rangeEnd,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type?: "date" | "month";
  rangeStart?: string;
  rangeEnd?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const today = iso(new Date());
  const current = typeof value === "string" ? value : "";
  const lower = typeof min === "string" ? min : "0001-01-01";
  const upper = typeof max === "string" ? max : "9999-12-31";
  const unit = (s: string) => (type === "month" ? s.slice(0, 7) : s);
  const allowed = (s: string) =>
    unit(s) >= unit(lower) && unit(s) <= unit(upper);
  const clamp = (s: string) =>
    unit(s) < unit(lower) ? lower : unit(s) > unit(upper) ? upper : s;
  const [view, setView] = useState(() => clamp(current || today).slice(0, 7));
  const [focus, setFocus] = useState(current || today);
  const titleId = useId();
  const date = parse(view),
    year = date.getFullYear(),
    month = date.getMonth();
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((offset + count) / 7);
  const change = (next: string) => {
    if (!input.current || disabled || readOnly || (next && !allowed(next)))
      return;
    // Use the same native change path as typing, including existing validation.
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input.current, next);
    input.current.dispatchEvent(new Event("input", { bubbles: true }));
    input.current.dispatchEvent(new Event("change", { bubbles: true }));
    setOpen(false);
  };
  const show = (next: boolean) => {
    if (next) {
      const initial = clamp(current || today);
      setView(initial.slice(0, 7));
      setFocus(unit(initial));
      setModal(!!input.current?.closest('[role="dialog"]'));
    }
    setOpen(next);
  };
  const move = (delta: number) => {
    const next = new Date(year, month + (type === "month" ? 0 : delta), 1, 12);
    if (type === "month") next.setFullYear(year + delta);
    setView(iso(next).slice(0, 7));
  };
  const shiftFocus = (target: string) => {
    const next = unit(clamp(target));
    setView(next.slice(0, 7));
    setFocus(next);
    pendingFocus.current = next;
  };
  useLayoutEffect(() => {
    if (pendingFocus.current) {
      panel.current
        ?.querySelector<HTMLButtonElement>(
          `[data-date="${pendingFocus.current}"]`,
        )
        ?.focus();
      pendingFocus.current = null;
    }
  }, [view, focus]);

  const minYear = Math.max(1, Number(lower.slice(0, 4))),
    maxYear = Math.min(9999, Number(upper.slice(0, 4)));
  // Unbounded inputs still allow ordinary historical/future dates without thousands of options.
  const years = Array.from(
    {
      length:
        Math.min(maxYear, Math.max(year + 100, 2100)) -
        Math.max(minYear, Math.min(year - 100, 1900)) +
        1,
    },
    (_, i) => Math.max(minYear, Math.min(year - 100, 1900)) + i,
  );
  return (
    <Popover open={open} onOpenChange={show} modal={modal}>
      <PopoverAnchor asChild>
        <span
          className="date-field"
          data-disabled={disabled || readOnly || undefined}
        >
          <input
            {...props}
            ref={input}
            type={type}
            value={value}
            min={min}
            max={max}
            disabled={disabled}
            readOnly={readOnly}
            onChange={onChange}
            onKeyDown={(event) => {
              props.onKeyDown?.(event);
              if (
                !event.defaultPrevented &&
                event.altKey &&
                event.key === "ArrowDown" &&
                !disabled &&
                !readOnly
              ) {
                event.preventDefault();
                show(true);
              }
            }}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              className="date-field-toggle"
              aria-label={type === "month" ? "Ay seç" : "Tarih seç"}
              title={props["aria-label"]}
              disabled={disabled || readOnly}
              onClick={(e) => e.stopPropagation()}
            >
              <CalendarDays size={16} aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </span>
      </PopoverAnchor>
      <PopoverContent
        className="date-calendar"
        align="start"
        side="bottom"
        collisionPadding={12}
        aria-labelledby={titleId}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            const target = panel.current?.querySelector<HTMLButtonElement>(
              `[data-date="${unit(clamp(current || today))}"]`,
            );
            (
              target ||
              panel.current?.querySelector<HTMLSelectElement>("select")
            )?.focus();
          });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          input.current?.focus();
        }}
      >
        <div ref={panel}>
          <h3 id={titleId} className="sr-only">
            {type === "month" ? "Ay seçimi" : "Tarih seçimi"}
          </h3>
          <div className="date-calendar-head">
            <button
              type="button"
              aria-label={type === "month" ? "Önceki yıl" : "Önceki ay"}
              disabled={
                type === "month" ? year <= minYear : view <= lower.slice(0, 7)
              }
              onClick={() => move(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            {type === "date" && (
              <FilterSelect
                aria-label="Takvim ayı"
                value={month}
                onChange={(e) =>
                  setView(
                    `${year}-${String(Number(e.target.value) + 1).padStart(2, "0")}`,
                  )
                }
              >
                {months.map((name, i) => (
                  <option
                    key={name}
                    value={i}
                    disabled={
                      `${year}-${String(i + 1).padStart(2, "0")}` <
                        lower.slice(0, 7) ||
                      `${year}-${String(i + 1).padStart(2, "0")}` >
                        upper.slice(0, 7)
                    }
                  >
                    {name}
                  </option>
                ))}
              </FilterSelect>
            )}
            <FilterSelect
              aria-label="Takvim yılı"
              value={year}
              onChange={(e) => {
                const y = Number(e.target.value);
                setView(
                  clamp(`${y}-${String(month + 1).padStart(2, "0")}-01`).slice(
                    0,
                    7,
                  ),
                );
              }}
            >
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </FilterSelect>
            <button
              type="button"
              aria-label={type === "month" ? "Sonraki yıl" : "Sonraki ay"}
              disabled={
                type === "month" ? year >= maxYear : view >= upper.slice(0, 7)
              }
              onClick={() => move(1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div
            className={type === "month" ? "date-month-grid" : "date-day-grid"}
            role="grid"
            aria-label={
              type === "month" ? `${year} ayları` : `${months[month]} ${year}`
            }
          >
            {type === "date" && (
              <div role="row" className="date-weekdays">
                {["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"].map((d) => (
                  <span role="columnheader" key={d}>
                    {d}
                  </span>
                ))}
              </div>
            )}
            {Array.from({ length: type === "month" ? 4 : weeks }, (_, row) => (
              <div role="row" key={row}>
                {Array.from({ length: type === "month" ? 3 : 7 }, (_, col) => {
                  const i = row * (type === "month" ? 3 : 7) + col;
                  const day = new Date(
                    year,
                    type === "month" ? i : month,
                    type === "month" ? 1 : i - offset + 1,
                    12,
                  );
                  const key = unit(iso(day)),
                    selected = key === current,
                    inRange =
                      !!rangeStart &&
                      !!rangeEnd &&
                      key >= rangeStart &&
                      key <= rangeEnd;
                  return (
                    <div role="gridcell" key={key} aria-selected={selected}>
                      <button
                        type="button"
                        data-date={key}
                        data-selected={selected || undefined}
                        data-today={key === unit(today) || undefined}
                        data-outside={
                          (type === "date" && day.getMonth() !== month) ||
                          undefined
                        }
                        data-range={inRange || undefined}
                        disabled={!allowed(key)}
                        tabIndex={key === focus ? 0 : -1}
                        aria-label={
                          type === "month"
                            ? `${months[i]} ${year}`
                            : day.toLocaleDateString("tr-TR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                        }
                        aria-current={key === unit(today) ? "date" : undefined}
                        onFocus={() => setFocus(key)}
                        onClick={() => change(key)}
                        onKeyDown={(e) => {
                          const step = type === "month" ? 3 : 7;
                          const delta = (
                            {
                              ArrowLeft: -1,
                              ArrowRight: 1,
                              ArrowUp: -step,
                              ArrowDown: step,
                            } as Record<string, number>
                          )[e.key];
                          if (delta !== undefined) {
                            e.preventDefault();
                            if (type === "month")
                              day.setMonth(day.getMonth() + delta);
                            else day.setDate(day.getDate() + delta);
                            shiftFocus(iso(day));
                          }
                          if (e.key === "Home" || e.key === "End") {
                            e.preventDefault();
                            const diff =
                              type === "month" ? col : (day.getDay() + 6) % 7;
                            const n =
                              e.key === "Home" ? -diff : step - 1 - diff;
                            if (type === "month")
                              day.setMonth(day.getMonth() + n);
                            else day.setDate(day.getDate() + n);
                            shiftFocus(iso(day));
                          }
                          if (e.key === "PageUp" || e.key === "PageDown") {
                            e.preventDefault();
                            const delta = e.key === "PageUp" ? -1 : 1;
                            const dayNumber = day.getDate();
                            day.setDate(1);
                            if (type === "month" || e.shiftKey)
                              day.setFullYear(day.getFullYear() + delta);
                            else day.setMonth(day.getMonth() + delta);
                            day.setDate(
                              Math.min(
                                dayNumber,
                                new Date(
                                  day.getFullYear(),
                                  day.getMonth() + 1,
                                  0,
                                ).getDate(),
                              ),
                            );
                            shiftFocus(iso(day));
                          }
                        }}
                      >
                        {type === "month" ? months[i] : day.getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="date-calendar-footer">
            <button
              type="button"
              disabled={!allowed(today)}
              onClick={() => change(unit(today))}
            >
              {type === "month" ? "Bu ay" : "Bugün"}
            </button>
            <button
              type="button"
              disabled={props.required || !current}
              onClick={() => change("")}
            >
              Temizle
            </button>
          </div>
          <p className="date-calendar-value" aria-live="polite">
            {current
              ? type === "month"
                ? `${months[parse(current).getMonth()]} ${parse(current).getFullYear()}`
                : parse(current).toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
              : "Seçim yapılmadı"}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
