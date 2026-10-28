import { ownValue } from "../../../../shared/records";
import { useMemo } from "react";
import { visibleActualInScope } from "../../../../shared/actual-visibility.ts";
import { createActualMonthIndex } from "../../../../shared/actual-months.ts";
import { groupPage, groupPageLists } from "../../metrics";
import type { PersonAllocationPanelProps } from "./types";
import { personGroups } from "./person-layout";

export type ActualLayout = "person" | "project";

type Scope = Pick<
  PersonAllocationPanelProps,
  | "data"
  | "teams"
  | "projects"
  | "months"
  | "currentMonth"
  | "selectedPersonIds"
  | "ownResourceId"
  | "monthSummaries"
  | "onlyDataRows"
>;

/** Derives a view of the snapshot; project filters never reduce capacity totals. */
export function useActualAllocationView(
  {
    data,
    teams,
    projects,
    months,
    currentMonth,
    selectedPersonIds,
    ownResourceId,
    monthSummaries,
    onlyDataRows,
  }: Scope,
  person: {
    layout: ActualLayout;
    query: string;
    added: ReadonlySet<string>;
  } = { layout: "project", query: "", added: new Set() },
) {
  const teamKey = teams.map((team) => team.id).join("|");
  const monthKey = months.join("|");
  const teamIds = useMemo(
    () => new Set(teams.map((team) => team.id)),
    [teamKey],
  );
  const eligible = useMemo(() => {
    const cells = new Set<string>();
    for (const resource of data.resources)
      for (const month of months)
        if (
          visibleActualInScope(
            resource,
            month,
            currentMonth,
            teamIds,
            ownResourceId,
          )
        )
          cells.add(resource.id + "|" + month);
    return cells;
  }, [data.resources, monthKey, teamIds, currentMonth, ownResourceId]);
  const selected = new Set(selectedPersonIds);
  const people = data.resources
    .filter(
      (resource) =>
        months.some((month) => eligible.has(resource.id + "|" + month)) &&
        (!selected.size || selected.has(resource.id)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const scopeKey =
    projects.map((project) => project.id).join("|") +
    ";" +
    people.map((person) => person.id).join("|") +
    ";" +
    monthKey +
    (onlyDataRows ? ";veri" : "") +
    ";" +
    person.layout +
    (person.layout === "person" ? ";" + person.query : "");
  const personList =
    person.layout === "person"
      ? personGroups({
          people,
          projects,
          months,
          actualAllocations: data.actualAllocations,
          added: person.added,
          query: person.query,
          onlyDataRows,
        })
      : [];
  // "Sadece Veri Olanlar": a person row stays only if it has a value in the
  // visible months for that project; projects without such rows are hidden.
  const dataLists =
    onlyDataRows && person.layout === "project"
      ? projects.map((project) =>
          people
            .map((_, index) => index)
            .filter((index) =>
              months.some(
                (month) =>
                  (data.actualAllocations?.[
                    people[index].id + "|" + project.id + "|" + month
                  ] || 0) !== 0,
              ),
            ),
        )
      : null;
  const totalRows =
    person.layout === "person"
      ? personList.length
      : dataLists
        ? dataLists.reduce((sum, list) => sum + list.length, 0)
        : projects.length * Math.max(people.length, 1);
  // One table for every row: the windowed sections mount as they scroll in,
  // so there is no page limit.
  const rows = Math.max(1, totalRows);
  const groups = dataLists
    ? groupPageLists(dataLists, 0, rows).groups
    : groupPage(projects.length, Math.max(people.length, 1), 0, rows);
  const actualMonths = useMemo(() => {
    const index = createActualMonthIndex(data);
    return {
      ...index,
      get: (id: string, month: string) =>
        ownValue(monthSummaries, id + "|" + month) || index.get(id, month),
    };
  }, [data, monthSummaries]);
  const personMonthTotals: Record<string, number> = {};
  for (const resource of people)
    for (const month of months)
      personMonthTotals[resource.id + "|" + month] = actualMonths.get(
        resource.id,
        month,
      ).totalFte;
  const years = [...new Set(months.map((month) => month.slice(0, 4)))];
  return {
    layout: person.layout,
    personPage: personList,
    eligible,
    people,
    scopeKey,
    monthKey,
    totalRows,
    groups,
    actualMonths,
    personMonthTotals,
    years,
  };
}
export type ActualAllocationView = ReturnType<typeof useActualAllocationView>;
