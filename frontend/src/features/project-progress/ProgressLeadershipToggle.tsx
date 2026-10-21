import { Switch } from "@/components/ui/switch";

export default function ProgressLeadershipToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (open: boolean) => void;
}) {
  return (
    <div className="workspace-view-options report-posting-options progress-leadership-options">
      <label>
        <Switch
          size="sm"
          aria-label="Liderlikleri Aç / Kapa"
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChange}
        />
        Liderlikleri Aç / Kapa
      </label>
    </div>
  );
}
