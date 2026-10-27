import { Check } from "lucide-react";
import Badge from "../../components/Badge";
import type { Project } from "../../model";

export default function CompletedProjectBadge({
  project,
}: {
  project: Project;
}) {
  return project.completed ? (
    <Badge tone="neutral" className="completed-planning-badge">
      <Check size={12} aria-hidden="true" />
      Tamamlandı
    </Badge>
  ) : null;
}
