import { visibleProjectsByCompletion } from "../../shared/project-completion";
import {
  actualEntryScope,
  canEnterActual,
  canManagePersonalCalendar,
} from "../../shared/actual-entry-access.ts";
import { useMemo, useState, useRef } from "react";
import type { Resource, Project } from "./model";
import type { ActualUnit } from "./actual-units";
import { writeBatch } from "./storage";
import {
  prepareActualAllocationChange,
  prepareWorkedHoursChange,
  type ActualEntry,
} from "./features/actual-allocation-commands";
import { Switch } from "@/components/ui/switch";
import ActualAllocationControls from "./features/actual-allocation/ActualAllocationControls";
import ActualAllocationTable from "./features/actual-allocation/ActualAllocationTable";
import ActualAllocationDialogs from "./features/actual-allocation/ActualAllocationDialogs";
import { useActualAllocationView } from "./features/actual-allocation/useActualAllocationView";
import { useActualCellSelection } from "./features/actual-allocation/useActualCellSelection";
import { useActualCapacityDialog } from "./features/actual-allocation/useActualCapacityDialog";
import { useViewChangeGuard } from "./features/workspace/useViewChangeGuard";
import type {
  PersonAllocationPanelProps,
  ActualCalendarMode,
  ActualPhaseDetail,
} from "./features/actual-allocation/types";
import EmptyState from "./components/EmptyState";

export default function PersonAllocationPanel(
  props: PersonAllocationPanelProps,
) {
  const {
    data,
    user,
    months,
    currentMonth,
    todayDate,
    canEditCalendar,
    sharedCalendarOpen,
    onSharedCalendarClose,
    ownResourceId,
    onSaved,
    layout,
    unit,
  } = props;
  const panelRef = useRef<HTMLElement | null>(null);
  const { error: visibilityError, guard: changeVisibleRows } =
    useViewChangeGuard(panelRef);
  const projects = useMemo(
    () =>
      visibleProjectsByCompletion(props.projects, props.showCompletedProjects),
    [props.projects, props.showCompletedProjects],
  );
  const [phaseDetail, setPhaseDetail] = useState<ActualPhaseDetail | null>(
    null,
  );
  const [calendarPerson, setCalendarPerson] = useState<Resource | null>(null);
  const [calendarMode, setCalendarMode] = useState<ActualCalendarMode>(null);
  const [query, setQuery] = useState("");
  // Session-only: rows opened with "+ Proje" and people folded shut.
  const [added, setAdded] = useState<ReadonlySet<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleIn =
    (
      set: (
        update: (current: ReadonlySet<string>) => ReadonlySet<string>,
      ) => void,
    ) =>
    (key: string, on?: boolean) =>
      set((current) => {
        const next = new Set(current);
        if (on ?? !next.has(key)) next.add(key);
        else next.delete(key);
        return next;
      });
  const view = useActualAllocationView(
    { ...props, projects },
    { layout, query, added },
  );
  const { totalRows, people, actualMonths } = view;
  const completedCount = props.projects.filter(
    (project) =>
      project.completed &&
      (!props.onlyDataRows ||
        people.some((person) =>
          months.some(
            (month) =>
              (data.actualAllocations?.[
                person.id + "|" + project.id + "|" + month
              ] || 0) !== 0,
          ),
        )),
  ).length;
  function changeCompletedVisibility(show: boolean) {
    changeVisibleRows("tamamlanan proje", () =>
      props.onShowCompletedProjectsChange(show),
    );
  }
  function changeOnlyDataRows(only: boolean) {
    changeVisibleRows("Sadece Veri Olanlar", () =>
      props.onOnlyDataRowsChange(only),
    );
  }
  const limit = useActualCapacityDialog();
  const { openLimit } = limit;
  const selection = useActualCellSelection({
    ...view,
    loading: props.loading,
    months,
    currentMonth,
    limitOpenRef: limit.openRef,
  });
  const { selectedCell, selectedHoursMonth, selectedHoursPerson } = selection;
  // Team Member: self · Product Owner: own team · Lider: teams under the
  // leadership · Admin: all (shared/actual-entry-access.ts, also on the server).
  const entryScope = useMemo(() => actualEntryScope(data, user), [data, user]);
  function canEditPersonMonth(id: string, month: string) {
    if (props.loading) return false;
    return canEnterActual(data, user, entryScope, id, month);
  }
  function canViewPersonalCalendar(id: string) {
    return canManagePersonalCalendar(data, user, entryScope, id);
  }
  async function save(
    resource: Resource,
    project: Project,
    month: string,
    entry: ActualEntry,
  ) {
    if (!canEditPersonMonth(resource.id, month))
      throw Error("Bu çalışanın verisini düzenleme yetkiniz yok.");
    onSaved(
      await writeBatch([
        prepareActualAllocationChange(
          data,
          resource.id,
          project.id,
          month,
          entry,
          actualMonths.get(resource.id, month),
        ),
      ]),
    );
  }

  async function saveHours(
    resource: Resource,
    month: string,
    hours: number | null,
    input: HTMLInputElement | null,
  ): Promise<boolean> {
    try {
      if (!canEditPersonMonth(resource.id, month))
        throw Error("Bu çalışanın verisini düzenleme yetkiniz yok.");
      onSaved(
        await writeBatch([
          prepareWorkedHoursChange(
            data,
            resource.id,
            month,
            hours,
            actualMonths.get(resource.id, month),
          ),
        ]),
      );
      return true;
    } catch (cause) {
      const message = (cause as Error).message;
      if (message.includes("%100") || message.includes("kapasitesini aşıyor")) {
        openLimit("hours", input);
        return false;
      }
      throw cause;
    }
  }
  return (
    <section className="panel person-allocation" ref={panelRef}>
      <ActualAllocationControls
        data={data}
        unit={unit}
        selectedHoursPerson={selectedHoursPerson}
        selectedHoursMonth={selectedHoursMonth}
        actualMonths={actualMonths}
        saveHours={saveHours}
        canEditPersonMonth={canEditPersonMonth}
      />
      <div className="actual-view-bar">
        {layout === "person" && (
          <input
            type="search"
            className="actual-person-search"
            aria-label="Kişi ara"
            placeholder="Kişi ara…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
        <label className="actual-only-data">
          <Switch
            size="sm"
            checked={props.onlyDataRows}
            onCheckedChange={changeOnlyDataRows}
          />
          Sadece Veri Olanlar
        </label>
        <div
          className="completed-planning-control"
          data-actual-context-cell="true"
        >
          <label title="Görünüm değişir; aylık toplamlar ve kapasite hesabı korunur.">
            <Switch
              size="sm"
              aria-label="Tamamlanan Projeleri Göster"
              checked={props.showCompletedProjects}
              onCheckedChange={changeCompletedVisibility}
            />
            Tamamlanan Projeleri Göster
          </label>
          {completedCount > 0 && (
            <span className="completed-planning-count">
              {completedCount} tamamlanan proje{" "}
              {props.showCompletedProjects ? "gösteriliyor" : "gizli"}
            </span>
          )}
        </div>
        <span className="actual-record-count">
          {totalRows} {layout === "person" ? "kişi" : "kişi / proje satırı"}
        </span>
      </div>
      {visibilityError && (
        <p className="completed-planning-error negative" role="alert">
          {visibilityError}
        </p>
      )}
      {!!projects.length && (
        <ActualAllocationTable
          data={data}
          projects={projects}
          months={months}
          currentMonth={currentMonth}
          todayDate={todayDate}
          unit={unit}
          view={view}
          selectedCell={selectedCell}
          selectHoursContext={selection.selectHoursContext}
          clearSelection={selection.clearSelection}
          save={save}
          canEditPersonMonth={canEditPersonMonth}
          canViewPersonalCalendar={canViewPersonalCalendar}
          openLimit={openLimit}
          onPhaseDetail={setPhaseDetail}
          onOpenPersonalCalendar={(resource) => {
            setCalendarPerson(resource);
            setCalendarMode("personal");
          }}
          personControls={{
            collapsed,
            onToggle: (personId) => toggleIn(setCollapsed)(personId),
            onAdd: (personId, projectId) => {
              toggleIn(setAdded)(personId + "|" + projectId, true);
              toggleIn(setCollapsed)(personId, false);
            },
          }}
        />
      )}
      <ActualAllocationDialogs
        data={data}
        calendarMode={sharedCalendarOpen ? "shared" : calendarMode}
        calendarPerson={sharedCalendarOpen ? null : calendarPerson}
        canEditCalendar={canEditCalendar}
        ownResourceId={ownResourceId}
        onSaved={onSaved}
        selectedCell={selectedCell}
        currentMonth={currentMonth}
        onCalendarClose={() => {
          onSharedCalendarClose();
          setCalendarMode(null);
          setCalendarPerson(null);
        }}
        limit={limit}
        phaseDetail={phaseDetail}
        onPhaseClose={() => setPhaseDetail(null)}
      />
      {!projects.length && (
        <EmptyState
          title={
            completedCount > 0 && !props.showCompletedProjects
              ? "Tamamlanan projeler gizli"
              : "Proje bulunamadı"
          }
          action={
            completedCount > 0 && !props.showCompletedProjects
              ? {
                  label: "Tamamlanan Projeleri Göster",
                  onClick: () => changeCompletedVisibility(true),
                }
              : props.onResetFilters && {
                  label: "Filtreleri Sıfırla",
                  onClick: props.onResetFilters,
                }
          }
        >
          {completedCount > 0 && !props.showCompletedProjects
            ? "Seçili filtrelerdeki tamamlanan projeleri görmek için görünüm seçeneğini açın."
            : "Seçili filtrelere ve döneme uyan proje yok."}
        </EmptyState>
      )}
      {!!projects.length &&
        layout === "person" &&
        !!query.trim() &&
        !totalRows && (
          <EmptyState
            title="Kişi bulunamadı"
            action={{ label: "Aramayı Temizle", onClick: () => setQuery("") }}
          >
            “{query.trim()}” ile eşleşen kişi yok.
          </EmptyState>
        )}
      {!!projects.length && props.onlyDataRows && !totalRows && (
        <EmptyState
          title="Veri olan satır yok"
          action={{
            label: "Tüm Satırları Göster",
            onClick: () => changeOnlyDataRows(false),
          }}
        >
          Seçili dönemde gerçekleşen değeri girilmiş satır bulunmuyor.
        </EmptyState>
      )}
      {!!projects.length && !people.length && (
        <EmptyState
          title="Dağıtılabilir kişi yok"
          action={
            props.onResetFilters && {
              label: "Filtreleri Sıfırla",
              onClick: props.onResetFilters,
            }
          }
        >
          Seçili filtrelerde kişi bulunamadı; yalnız proje aşamaları
          gösteriliyor.
        </EmptyState>
      )}
    </section>
  );
}
