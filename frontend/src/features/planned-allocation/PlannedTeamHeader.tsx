import { TableRow, TableCell } from "@/components/ui/table";
import { planningUnitHierarchy } from "../../../../shared/leadership-planning";
import type { Team } from "../../model";
import type { PlannedAllocationProps } from "./types";
import {
  PlannedActualToggle,
  PlannedTeamBadge,
  PlannedUnitName,
} from "./PlannedTeamLabels";

type Props = Pick<
  PlannedAllocationProps,
  | "data"
  | "months"
  | "currentMonth"
  | "currentTeamMembers"
  | "showAllActual"
  | "expandedActualTeams"
  | "onExpandedTeamsChange"
> & { team: Team; managerName: string };

export default function PlannedTeamHeader({
  team,
  managerName,
  ...props
}: Props) {
  return (
    <TableRow
      className="group project-freeze-row team-capacity-header"
      data-project-heading={`team:${team.id}`}
      data-planning-group={team.id}
      data-hierarchy-depth={planningUnitHierarchy(props.data, team).depth}
    >
      <TableCell className="team-capacity-label">
        <div className="team-group-label">
          <PlannedActualToggle team={team} {...props} />
          <div>
            <div className="team-heading">
              <strong>
                <PlannedUnitName data={props.data} team={team} />
              </strong>
              <PlannedTeamBadge team={team} {...props} />
            </div>
            <span>Yönetici: {managerName}</span>
          </div>
        </div>
      </TableCell>
      {/* Month cells stay empty: capacity per month is in the Kalan Kaynak
          report above the table. */}
      {props.months.map((month) => (
        <TableCell
          key={month}
          className="team-capacity-month"
          data-team-capacity-month={month}
        />
      ))}
    </TableRow>
  );
}
