import type { ReactNode } from "react";

/** One pattern for empty, unauthorised and filtered-out screens: a short
 * title, one sentence on why, and at most one button that resolves it. */
export default function EmptyState({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={"emptymsg empty-state " + className} role="status">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action && (
        <button type="button" className="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
