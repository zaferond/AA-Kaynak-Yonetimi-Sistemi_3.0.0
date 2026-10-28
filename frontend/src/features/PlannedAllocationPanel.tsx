import { Switch } from "@/components/ui/switch";
import { useMemo, useState } from "react";
import {
  completedPlanningCount,
  visiblePlanningProjects,
} from "./planned-allocation/completed-projects";
import EmptyState from "../components/EmptyState";
import PlannedCapacitySummary from "./planned-allocation/PlannedCapacitySummary";
import PlannedAllocationTable from "./planned-allocation/PlannedAllocationTable";
import type { PlannedAllocationProps } from "./planned-allocation/types";
import { useViewportWorkspace } from "./workspace/useViewportWorkspace";
export default function PlannedAllocationPanel(props: PlannedAllocationProps) {
  const { teams, projects, groups, onlyDataRows } = props;
  const viewportRef = useViewportWorkspace();
  const [visibilityError, setVisibilityError] = useState("");
  const completedCount = useMemo(
    () =>
      completedPlanningCount({
        allocations: props.data.allocations,
        projects,
        teamIds: teams.map((team) => team.id),
        months: props.months,
        onlyDataRows,
      }),
    [props.data.allocations, projects, teams, props.months, onlyDataRows],
  );
  const visibleProjects = visiblePlanningProjects(
    projects,
    props.showCompletedProjects,
  );
  function changeCompletedVisibility(show: boolean) {
    if (
      props.planTableRef.current?.querySelector('[data-window-keep="true"]')
    ) {
      setVisibilityError(
        "Değişiklikleri kaydedin veya Escape ile iptal edin; ardından tamamlanan proje görünümünü değiştirebilirsiniz.",
      );
      return;
    }
    setVisibilityError("");
    props.onShowCompletedProjectsChange(show);
  }
  return (
    <section className="panel workspace-dock" ref={viewportRef}>
      <PlannedCapacitySummary {...props} />
      <div
        className="workspace-view-options"
        role="group"
        aria-label="Görünüm seçenekleri"
      >
        <label>
          <Switch
            size="sm"
            checked={props.showAllActual}
            onCheckedChange={props.onShowAllActualChange}
          />
          Gerçekleşen Dağılım Göster
        </label>
        <label>
          <Switch
            size="sm"
            checked={onlyDataRows}
            onCheckedChange={props.onOnlyDataRowsChange}
          />
          Sadece Veri Olanlar
        </label>
        <div className="completed-planning-control">
          <label>
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
      </div>
      {visibilityError && (
        <p className="completed-planning-error negative" role="alert">
          {visibilityError}
        </p>
      )}
      <PlannedAllocationTable {...props} />
      {(!teams.length || !visibleProjects.length) && (
        <EmptyState
          title={
            teams.length && completedCount > 0 && !props.showCompletedProjects
              ? "Tamamlanan projeler gizli"
              : "Gösterilecek plan yok"
          }
          action={
            teams.length && completedCount > 0 && !props.showCompletedProjects
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
          {teams.length && completedCount > 0 && !props.showCompletedProjects
            ? "Seçili filtrelerde yalnız tamamlanan projeler var. Görünüm seçeneğini açarak kayıtları inceleyebilirsiniz."
            : "Seçili filtrelere uyan takım veya proje bulunamadı."}
        </EmptyState>
      )}
      {!!teams.length &&
        !!visibleProjects.length &&
        onlyDataRows &&
        !groups.length && (
          <EmptyState
            title="Veri olan satır yok"
            action={{
              label: "Tüm Satırları Göster",
              onClick: () => props.onOnlyDataRowsChange(false),
            }}
          >
            Seçili dönemde planlanan dağılımı olan satır bulunmuyor.
          </EmptyState>
        )}
      <footer className="tablefoot">
        <span>Birim: aylık kişi eşdeğeri · Ondalık giriş: 0,5</span>
        <span>
          Fareyle sürükleyerek aralık seçin; sağ tıkla kopyalayıp yapıştırın.
          Proje dönemi dışına giriş yapılamaz.
        </span>
      </footer>
    </section>
  );
}
