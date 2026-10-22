import { useState } from "react";
import type { ActualLayout } from "./useActualAllocationView";

const LAYOUT_KEY = "aa.actualLayout";
function initialLayout(): ActualLayout {
  try {
    // Proje Bazlı unless the user chose Kişi Bazlı before.
    return localStorage.getItem(LAYOUT_KEY) === "person" ? "person" : "project";
  } catch {
    return "project";
  }
}
export function useActualLayout() {
  const [layout, setLayoutState] = useState<ActualLayout>(initialLayout);
  function setLayout(next: ActualLayout) {
    setLayoutState(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // The choice still applies for this session.
    }
  }
  return [layout, setLayout] as const;
}
