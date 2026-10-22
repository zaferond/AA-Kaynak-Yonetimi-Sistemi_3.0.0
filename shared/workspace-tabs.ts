/** Every workspace screen id. "home" is Ana Sayfa, the default opening
 * screen; the others match the sidebar tabs. */
export const WORKSPACE_TAB_IDS = [
  "home",
  "projects",
  "plan",
  "progress",
  "risk",
  "critical",
  "overview",
  "actual",
  "activity",
  "resources",
] as const;
export type WorkspaceTabId = (typeof WORKSPACE_TAB_IDS)[number];
export const HOME_TAB: WorkspaceTabId = "home";
