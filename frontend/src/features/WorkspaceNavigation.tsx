import { useEffect, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Layers3,
  Plus,
  PanelLeftClose,
  ChevronRight,
} from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Principal } from "../access";
import { SYSTEM_NAME, TAB_LABELS } from "../settings";
import { isProjectEditor } from "../../../shared/project-access.ts";
import type { WorkspaceMenu } from "./workspace/useWorkspaceMenu";
import WorkspaceSectionHeader, {
  type WorkspaceSectionTab,
} from "./workspace/WorkspaceSectionHeader";
import ReportDownloadButton from "../components/ReportDownloadButton";
import WorkspaceDensityControl from "./workspace/WorkspaceDensityControl";
import WorkspaceViewControl from "./workspace/WorkspaceViewControl";
import { menuTabs } from "./workspace/menu-tabs";
import type { ActualLayout } from "./actual-allocation/useActualAllocationView";
import type { ActualUnit } from "../actual-units";
import type { ProgressView } from "./project-progress/ProjectProgressPanel";
export type WorkspaceDensity = "detail" | "compact" | "overview";
export type ReportView = "resources" | "headcount";
export type ProjectView = "projects" | "scenario";
type Props = {
  sidebarHost: HTMLElement | null;
  menu: WorkspaceMenu;
  user: Principal | null;
  tab: string;
  mainTabsRef: RefObject<HTMLDivElement | null>;
  density: WorkspaceDensity;
  setDensity: (density: WorkspaceDensity) => void;
  setCount: (count: number) => void;
  view: string;
  setView: (view: string) => void;
  openProject: () => void;
  onOpenSharedCalendar: () => void;
  reportPostingControl?: ReactNode;
  /** Saved drafts waiting for an admin decision. */
  pendingScenarios?: number;
  onExport: () => void;
  dataLoaded: boolean;
  hasTeams: boolean;
  hasProjects: boolean;
  organizationView: string;
  setOrganizationView: (view: string) => void;
  reportView: ReportView;
  setReportView: (view: ReportView) => void;
  actualLayout: ActualLayout;
  setActualLayout: (view: ActualLayout) => void;
  actualUnit: ActualUnit;
  setActualUnit: (unit: ActualUnit) => void;
  activityUnit: ActualUnit;
  setActivityUnit: (unit: ActualUnit) => void;
  progressView: ProgressView;
  progressActionsRef: (node: HTMLDivElement | null) => void;
  setProgressView: (view: ProgressView) => void;
  projectView: ProjectView;
  setProjectView: (view: ProjectView) => void;
  pendingProgressApprovals: number;
};
export default function WorkspaceNavigation({
  sidebarHost,
  menu,
  user,
  tab,
  mainTabsRef,
  density,
  setDensity,
  setCount,
  view,
  setView,
  openProject,
  onOpenSharedCalendar,
  reportPostingControl,
  pendingScenarios = 0,
  onExport,
  dataLoaded,
  hasTeams,
  hasProjects,
  organizationView,
  setOrganizationView,
  reportView,
  setReportView,
  actualLayout,
  setActualLayout,
  actualUnit,
  setActualUnit,
  activityUnit,
  setActivityUnit,
  progressView,
  progressActionsRef,
  setProgressView,
  projectView,
  setProjectView,
  pendingProgressApprovals,
}: Props) {
  useEffect(() => {
    if (!menu.open) return;
    const list = mainTabsRef.current;
    const active = list?.querySelector<HTMLElement>(
      '[role="tab"][data-state="active"]',
    );
    if (list && active) {
      if (active.offsetTop < list.scrollTop) list.scrollTop = active.offsetTop;
      else if (
        active.offsetTop + active.offsetHeight >
        list.scrollTop + list.clientHeight
      )
        list.scrollTop =
          active.offsetTop + active.offsetHeight - list.clientHeight;
    }
  }, [menu.open, tab, mainTabsRef]);
  const isAdmin = user?.role === "admin",
    isManager = user?.role === "manager",
    projectEditor = isProjectEditor(user);
  const mainTabs = menuTabs(user);
  let sectionTabs: WorkspaceSectionTab[] = [],
    sectionValue = tab;
  let changeSection: (value: string) => void = () => {};
  let sectionLabel = "Ekran görünümleri";
  // Kaynak Planlama and Aktivite Giriş choose their layout in a "Görünüm"
  // list next to the page actions instead of view tabs.
  const viewChoice =
    tab === "plan" ? (
      <WorkspaceViewControl
        value={view}
        options={[
          { value: "project", label: "Proje Bazlı" },
          { value: "team", label: "Takım Bazlı" },
        ]}
        onChange={setView}
      />
    ) : tab === "actual" ? (
      <>
        <WorkspaceViewControl
          label="Kaynak Dağılım Birimi"
          id="actual-entry-unit"
          value={actualUnit}
          options={[
            { value: "percent", label: "Yüzde (%)" },
            { value: "hours", label: "Saat" },
          ]}
          onChange={(value) => setActualUnit(value as ActualUnit)}
        />
        <WorkspaceViewControl
          value={actualLayout}
          options={[
            { value: "project", label: "Proje Bazlı" },
            { value: "person", label: "Kişi Bazlı" },
          ]}
          onChange={(value) => setActualLayout(value as ActualLayout)}
        />
      </>
    ) : tab === "activity" ? (
      <WorkspaceViewControl
        ariaLabel="Aktivite raporu birimi"
        value={activityUnit}
        options={[
          { value: "percent", label: "Yüzde (%)" },
          { value: "hours", label: "Saat" },
        ]}
        onChange={(value) => setActivityUnit(value as ActualUnit)}
      />
    ) : null;
  if (tab === "projects") {
    sectionTabs = [
      { value: "projects", label: "Projeler" },
      ...(isAdmin || isManager
        ? [
            {
              value: "scenario",
              label: "Proje Takvimi Güncelle",
              badge: isAdmin ? pendingScenarios : 0,
            },
          ]
        : []),
    ];
    sectionValue = projectView;
    changeSection = (value) => setProjectView(value as ProjectView);
    sectionLabel = "Proje görünümü";
  } else if (tab === "progress") {
    sectionTabs = [
      {
        value: "plan",
        label: "Hedef Plan / Gerçekleşen Plan Giriş",
        badge: isAdmin ? pendingProgressApprovals : 0,
      },
      { value: "report", label: "Proje ve Kaynak Değerlendirme Raporu" },
      { value: "warnings", label: "Senaryo Uyarıları" },
      ...(isAdmin ? [{ value: "settings", label: "Uyarı Ayarları" }] : []),
    ];
    sectionValue = progressView;
    changeSection = (value) => setProgressView(value as ProgressView);
    sectionLabel = "İlerleme görünümü";
  } else if (tab === "overview") {
    sectionTabs = [
      { value: "resources", label: "Kaynak Raporları" },
      { value: "headcount", label: "Head Count" },
    ];
    sectionValue = reportView;
    changeSection = (value) => setReportView(value as ReportView);
    sectionLabel = "Kaynak raporu görünümü";
  } else if (tab === "resources") {
    sectionTabs = [
      { value: "employees", label: "Çalışan & Yetki Tanımlama" },
      { value: "teams", label: "Organizasyon Yapısı" },
    ];
    sectionValue = organizationView;
    changeSection = setOrganizationView;
    sectionLabel = "Organizasyon görünümü";
  }
  const sectionTitle = [
    "progress",
    "resources",
    "overview",
    "projects",
  ].includes(tab)
    ? sectionTabs.find((item) => item.value === sectionValue)?.label ||
      TAB_LABELS[tab as keyof typeof TAB_LABELS]
    : TAB_LABELS[tab as keyof typeof TAB_LABELS];
  return (
    <div className="workspace-nav">
      {sidebarHost &&
        createPortal(
          <>
            <button
              ref={menu.triggerRef}
              type="button"
              className="workspace-menu-edge"
              inert={menu.open}
              aria-hidden={menu.open}
              data-workspace-menu-trigger
              aria-label="Sol menüyü aç"
              aria-controls="workspace-main-menu"
              aria-expanded={menu.open}
              onClick={(event) => !menu.open && menu.toggle(event.detail === 0)}
            >
              <ChevronRight
                className="workspace-menu-edge-icon"
                size={18}
                aria-hidden="true"
              />
              <span className="workspace-menu-edge-caption" aria-hidden="true">
                Menü
              </span>
            </button>
            <aside
              id="workspace-main-menu"
              className="workspace-menu-panel"
              ref={menu.panelRef}
              data-open={menu.open}
              data-pinned={menu.pinned}
              aria-label="Ana menü"
              aria-hidden={!menu.open}
              inert={!menu.open}
            >
              <div className="workspace-menu-heading">
                <div className="workspace-menu-brand">
                  <Layers3 size={20} aria-hidden="true" />
                  <h1>{SYSTEM_NAME}</h1>
                </div>
                <button
                  type="button"
                  className="iconbutton"
                  aria-label="Sol menüyü kapat"
                  onClick={() => menu.close(true)}
                >
                  <PanelLeftClose size={18} />
                </button>
              </div>
              <TabsList
                ref={mainTabsRef}
                className="navtabs"
                variant="line"
                aria-label="Ana sekmeler"
              >
                {mainTabs.map((item, index) => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    data-tab-group={item.group}
                    // A thin divider marks where a new group of tabs begins.
                    data-group-start={
                      index > 0 && mainTabs[index - 1].group !== item.group
                        ? ""
                        : undefined
                    }
                  >
                    <item.Icon />
                    <span>{TAB_LABELS[item.value]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </aside>
          </>,
          sidebarHost,
        )}
      <WorkspaceSectionHeader
        title={sectionTitle}
        label={sectionLabel}
        tabs={sectionTabs}
        value={sectionValue}
        onChange={changeSection}
        actionsPlacement={
          ["actual", "projects", "plan", "overview"].includes(tab) ||
          (tab === "progress" && ["plan", "report"].includes(progressView))
            ? "tabs"
            : "heading"
        }
        actions={
          tab === "progress" && ["plan", "report"].includes(progressView) ? (
            <div
              className="workspace-nav-actions progress-report-actions"
              ref={progressActionsRef}
            />
          ) : (
            ![
              "home",
              "access",
              "teams",
              "critical",
              "risk",
              "progress",
            ].includes(tab) &&
            !(tab === "projects" && projectView === "scenario") && (
              <div className="workspace-nav-actions">
                {viewChoice}
                {tab === "projects" && (
                  <WorkspaceDensityControl
                    value={density}
                    onChange={(mode) => {
                      setDensity(mode);
                      if (mode === "overview") setCount(60);
                    }}
                  />
                )}
                {tab === "overview" &&
                  reportView === "resources" &&
                  reportPostingControl}
                {tab === "projects" && (isAdmin || projectEditor) && (
                  <button
                    className="button project-create"
                    onClick={() => openProject()}
                  >
                    <Plus size={17} />
                    Yeni Proje
                  </button>
                )}
                {tab === "actual" && isAdmin && (
                  <button
                    type="button"
                    className="button"
                    aria-label="Çalışma Takvimi'ni aç"
                    onClick={onOpenSharedCalendar}
                    disabled={!dataLoaded}
                  >
                    <CalendarDays size={17} />
                    Çalışma Takvimi
                  </button>
                )}
                {tab !== "resources" && (
                  <ReportDownloadButton
                    label={
                      tab === "projects"
                        ? "Proje Raporunu İndir"
                        : tab === "activity"
                          ? "Aktivite Raporunu Excel'e Aktar"
                          : tab === "overview"
                            ? reportView === "headcount"
                              ? "Head Count Excel'e Aktar"
                              : "Kaynak Raporu İndir"
                            : "Excel'e Aktar"
                    }
                    onClick={onExport}
                    disabled={
                      !dataLoaded ||
                      (tab === "overview" && !hasTeams) ||
                      (tab === "projects" && !hasProjects)
                    }
                  />
                )}
              </div>
            )
          )
        }
      />
    </div>
  );
}
