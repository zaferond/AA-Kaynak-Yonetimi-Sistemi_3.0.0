import type { ButtonHTMLAttributes } from "react";
import { ArrowDownToLine } from "lucide-react";

/** A consistent download action with its purpose available on hover and focus. */
export default function ReportDownloadButton({
  label,
  className = "",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
}) {
  return (
    <button
      type="button"
      {...props}
      className={"button report-download-button " + className}
      aria-label={label}
      title={label}
    >
      <ArrowDownToLine size={17} aria-hidden="true" />
    </button>
  );
}
