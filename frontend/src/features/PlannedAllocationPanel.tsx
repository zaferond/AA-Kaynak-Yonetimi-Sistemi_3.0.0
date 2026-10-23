import { Switch } from "@/components/ui/switch";
import EmptyState from "../components/EmptyState";
import PlannedCapacitySummary from "./planned-allocation/PlannedCapacitySummary";
import PlannedAllocationTable from "./planned-allocation/PlannedAllocationTable";
import type { PlannedAllocationProps } from "./planned-allocation/types";
import { useViewportWorkspace } from "./workspace/useViewportWorkspace";
export default function PlannedAllocationPanel(props: PlannedAllocationProps) {
  const { teams, projects, groups, onlyDataRows } = props;
  const viewportRef = useViewportWorkspace();
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
          Sadece veri olanlar
        </label>
      </div>
      <PlannedAllocationTable {...props} />
      {(!teams.length || !projects.length) && (
        <EmptyState
          title="Gösterilecek plan yok"
          action={
            props.onResetFilters && {
              label: "Filtreleri Sıfırla",
              onClick: props.onResetFilters,
            }
          }
        >
          Seçili filtrelere uyan takım veya proje bulunamadı.
        </EmptyState>
      )}
      {!!teams.length &&
        !!projects.length &&
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
