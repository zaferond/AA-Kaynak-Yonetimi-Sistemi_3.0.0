import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Data } from "../../model";
import { buildCapacityIndex, type Metric } from "../../metrics";
import {
  applyScenario,
  type ShiftScenario,
} from "../../../../shared/schedule-shift.ts";
import { workspaceMetric } from "../workspace/workspace-selectors";
import {
  newScenario,
  nextScenarioName,
  type ScenarioDraft,
} from "./scenario-comparison";

const usable = (scenario: ShiftScenario) =>
  scenario.shifts.some((s) => s.projectId && s.months);

// Working cards and the saved scenarios under comparison survive a page
// refresh for this browser session; saved records live on the server.
const CARDS_KEY = "aa.scenarioCards";
const COMPARED_KEY = "aa.scenarioCompared";
function readSession<T>(key: string, valid: (value: unknown) => value is T) {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) || "null");
    return valid(value) ? value : null;
  } catch {
    return null;
  }
}
function writeSession(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Still kept in memory for this page.
  }
}
function useSessionValue<T>(
  key: string | null,
  fallback: () => T,
  valid: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const load = () => ({
    key,
    value: (key && readSession(key, valid)) || fallback(),
  });
  const [stored, setStored] = useState(load);
  // Reset before committing a render for another authenticated owner.
  if (stored.key !== key) setStored(load());
  useEffect(() => {
    if (key && stored.key === key) writeSession(key, stored.value);
  }, [key, stored]);
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((value) => {
    setStored((current) => ({
      ...current,
      value:
        typeof value === "function"
          ? (value as (old: T) => T)(current.value)
          : value,
    }));
  }, []);
  return [stored.value, setValue];
}
const isCards = (value: unknown): value is ScenarioDraft[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (s) =>
      s &&
      typeof s.id === "string" &&
      typeof s.name === "string" &&
      typeof s.includeTimeline === "boolean" &&
      (s.editingRevision === undefined ||
        (Number.isSafeInteger(s.editingRevision) && s.editingRevision >= 0)) &&
      Array.isArray(s.shifts) &&
      s.shifts.length > 0 &&
      s.shifts.every(
        (shift: unknown) =>
          !!shift &&
          typeof (shift as ShiftScenario["shifts"][0]).projectId === "string" &&
          typeof (shift as ShiftScenario["shifts"][0]).months === "number" &&
          typeof (shift as ShiftScenario["shifts"][0]).fromMonth === "string",
      ),
  );
const isIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === "string");

/** Scenarios of the session: the cards being defined (unsaved) and the saved
 * scenarios picked for comparison. The resource reports can be drawn for one
 * of them. Cards are saved only with "Ekle". */
export function useScheduleScenarios(
  data: Data | null,
  months: string[],
  currentMonth: string,
  userId: string | undefined,
) {
  const owner = userId ? encodeURIComponent(userId) : null;
  useEffect(() => {
    // Shared legacy drafts have no trustworthy owner; do not migrate them.
    try {
      sessionStorage.removeItem(CARDS_KEY);
      sessionStorage.removeItem(COMPARED_KEY);
    } catch {
      /* Storage may be disabled. */
    }
  }, []);
  const [scenarios, setScenarios] = useSessionValue(
    owner ? `${CARDS_KEY}:${owner}` : null,
    () => [newScenario("Senaryo A", currentMonth, 3)],
    isCards,
  );
  const [comparedIds, setComparedIds] = useSessionValue(
    owner ? `${COMPARED_KEY}:${owner}` : null,
    () => [],
    isIds,
  );
  const [reportScenarioId, setReportScenarioId] = useState<string | null>(null);
  // Saved scenarios taken off the reports for this session ("Senaryoları
  // Sil"); comparing one again opens it as a card and brings it back.
  const [hiddenSaved, setHiddenSaved] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // An untouched working card must not share its name with a saved scenario.
  const saved = data?.scheduleScenarios;
  useEffect(() => {
    if (!saved?.length) return;
    setScenarios((all) => {
      let changed = false;
      const next = all.map((card) => {
        const pristine = card.shifts.every((s) => !s.projectId);
        const owned = saved.some((s) => s.id === card.id);
        if (!pristine || owned || !saved.some((s) => s.name === card.name))
          return card;
        changed = true;
        return {
          ...card,
          name: nextScenarioName([...all.filter((c) => c !== card), ...saved]),
        };
      });
      return changed ? next : all;
    });
  }, [saved]);
  // Reports use saved, problem-free draft/approved scenarios only.
  const available = useMemo(() => {
    if (!data) return [];
    const savedOpen = (saved || []).filter(
      (s) =>
        !hiddenSaved.has(s.id) &&
        (s.status === "draft" || s.status === "approved"),
    );
    return savedOpen.filter(
      (s) => usable(s) && !applyScenario(data, s).problems.length,
    );
  }, [data, saved, hiddenSaved]);
  const active = available.find((s) => s.id === reportScenarioId) || null;
  const report = useMemo(() => {
    if (!data || !active) return null;
    const scenarioData = applyScenario(data, active).data;
    const cache = buildCapacityIndex(scenarioData, months);
    return {
      scenario: active,
      data: scenarioData,
      cache,
      metric: (ids: string[], month: string): Metric =>
        workspaceMetric(cache, ids, month),
    };
  }, [data, active, months]);
  /** Take every scenario off the reports; saved records are not deleted. */
  function clearReportScenarios() {
    setHiddenSaved(new Set((saved || []).map((s) => s.id)));
    setScenarios([newScenario(nextScenarioName(saved || []), currentMonth, 3)]);
    setComparedIds([]);
    setReportScenarioId(null);
  }
  return {
    scenarios,
    setScenarios,
    comparedIds,
    setComparedIds,
    clearReportScenarios,
    available,
    reportScenarioId: active?.id || null,
    setReportScenarioId,
    report,
  };
}
