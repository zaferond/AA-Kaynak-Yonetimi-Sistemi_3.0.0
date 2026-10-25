import type { ButtonHTMLAttributes } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import "./flow-button.css";

/** Primary action with a decorative indicator; native form/keyboard behavior stays intact. */
export default function FlowButton({
  children,
  className = "button primary",
  busy = false,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...props}
      className={className + " flow-button"}
      disabled={disabled || busy}
      aria-busy={busy || props["aria-busy"]}
    >
      {children}
      <span className="flow-button-indicator" aria-hidden="true">
        {busy ? (
          <LoaderCircle className="flow-button-spinner" />
        ) : (
          <ArrowRight />
        )}
      </span>
    </button>
  );
}
