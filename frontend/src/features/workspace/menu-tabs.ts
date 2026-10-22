import {
  CalendarCheck,
  CalendarDays,
  Clock3,
  FolderKanban,
  House,
  Layers3,
  ListChecks,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Principal } from "../../access";
import { RISK_MANAGEMENT_ENABLED } from "../../settings";
import { isProjectEditor } from "../../../../shared/project-access.ts";

/** The sidebar screens the user may open, in order and group. Ana Sayfa
 * shows the same list (without itself) as cards. */
export function menuTabs(user: Principal | null) {
  const isAdmin = user?.role === "admin",
    isManager = user?.role === "manager",
    projectEditor = isProjectEditor(user);
  // "Normal-Proje" sees only the project and critical-topic screens.
  const anyRole =
    isAdmin || isManager || (user?.role === "normal" && !projectEditor);
  // Order and grouping: home · planning and projects · reports · actuals ·
  // administration.
  return (
    [
      { value: "home", Icon: House, group: "home", show: true },
      { value: "projects", Icon: FolderKanban, group: "planning", show: true },
      {
        value: "plan",
        Icon: CalendarDays,
        group: "planning",
        show: isAdmin || isManager,
      },
      {
        value: "progress",
        Icon: TrendingUp,
        group: "planning",
        show: isAdmin || isManager,
      },
      {
        value: "risk",
        Icon: ShieldAlert,
        group: "planning",
        show: RISK_MANAGEMENT_ENABLED,
      },
      {
        value: "critical",
        Icon: ListChecks,
        group: "planning",
        show: isAdmin || isManager || projectEditor,
      },
      {
        value: "overview",
        Icon: Layers3,
        group: "reports",
        show: isAdmin || isManager,
      },
      { value: "actual", Icon: CalendarCheck, group: "actuals", show: anyRole },
      { value: "activity", Icon: Clock3, group: "actuals", show: anyRole },
      { value: "resources", Icon: Users, group: "admin", show: isAdmin },
    ] as const
  ).filter((item) => item.show);
}
export type MenuTab = ReturnType<typeof menuTabs>[number];
