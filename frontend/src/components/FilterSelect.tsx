import {
  Children,
  isValidElement,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

type Choice = { value: string; label: string; disabled: boolean };
function choices(children: ReactNode, inheritedDisabled = false): Choice[] {
  return Children.toArray(children).flatMap((node) => {
    if (
      !isValidElement<{
        value?: string | number;
        label?: string;
        disabled?: boolean;
        children?: ReactNode;
      }>(node)
    )
      return [];
    const props = node.props;
    if (node.type === "option") {
      const label = props.label || Children.toArray(props.children).join("");
      return [
        {
          value: String(props.value ?? label),
          label,
          disabled: inheritedDisabled || !!props.disabled,
        },
      ];
    }
    return choices(props.children, inheritedDisabled || !!props.disabled);
  });
}
import { Check } from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import "./filter-select.css";

/** Keep the native form value; anchor the visible choices to the field rather than an OS menu. */
export default function FilterSelect({
  children,
  onChange,
  onPointerDown,
  onKeyDown,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const ref = useRef<HTMLSelectElement>(null),
    list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [modal, setModal] = useState(false);
  const id = useId();
  const options = choices(children);
  const show = () => {
    if (props.disabled) return;
    setModal(!!ref.current?.closest('[role="dialog"]'));
    setOpen(true);
  };
  const select = (value: string) => {
    if (!ref.current) return;
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )!.set!.call(ref.current, value);
    ref.current.dispatchEvent(new Event("change", { bubbles: true }));
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverAnchor asChild>
        <select
          {...props}
          ref={ref}
          onChange={onChange}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onPointerDown={(event) => {
            onPointerDown?.(event);
            if (!event.defaultPrevented && event.button === 0) {
              event.preventDefault();
              show();
            }
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (
              !event.defaultPrevented &&
              [" ", "Enter", "ArrowDown", "ArrowUp"].includes(event.key)
            ) {
              event.preventDefault();
              show();
            }
          }}
        >
          {children}
        </select>
      </PopoverAnchor>
      <PopoverContent
        className="filter-select-panel"
        align="start"
        side="bottom"
        collisionPadding={12}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            const chosen = list.current?.querySelector<HTMLButtonElement>(
              '[aria-selected="true"]:not(:disabled)',
            );
            const first = list.current?.querySelector<HTMLButtonElement>(
              "button:not(:disabled)",
            );
            (chosen || first)?.focus();
          });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          ref.current?.focus();
        }}
      >
        <div
          ref={list}
          id={id}
          role="listbox"
          aria-label="Filtre seçenekleri"
          onKeyDown={(event) => {
            const choices = [
              ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            ];
            const i = choices.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const next =
              event.key === "ArrowDown"
                ? (i + 1) % choices.length
                : event.key === "ArrowUp"
                  ? (i - 1 + choices.length) % choices.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? choices.length - 1
                      : -1;
            if (next >= 0) {
              event.preventDefault();
              choices[next]?.focus();
            }
            if (event.key.length === 1 && event.key !== " ") {
              const match = [
                ...choices.slice(i + 1),
                ...choices.slice(0, i + 1),
              ].find((b) =>
                b.textContent
                  ?.trim()
                  .toLocaleLowerCase("tr")
                  .startsWith(event.key.toLocaleLowerCase("tr")),
              );
              match?.focus();
            }
          }}
        >
          {options.map((option, index) => (
            <button
              type="button"
              role="option"
              key={index}
              aria-selected={
                option.value === String(props.value ?? ref.current?.value)
              }
              disabled={option.disabled}
              onClick={() => select(option.value)}
            >
              <span>{option.label}</span>
              {option.value === String(props.value ?? ref.current?.value) && (
                <Check size={14} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
