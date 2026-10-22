import { currentUser } from "./storage";
import { HOME_TAB } from "../../shared/workspace-tabs.ts";
import { menuTabs } from "./features/workspace/menu-tabs";

/** The screens the user may open, in sidebar order; the same list offers the
 * opening screen ("Varsayılan sekme"). */
export function allowedDefaultTabs(
  user: ReturnType<typeof currentUser>,
): readonly string[] {
  return menuTabs(user).map((tab) => tab.value);
}
/** The account's opening screen: its stored choice while still allowed,
 * otherwise Ana Sayfa. */
export function readDefaultTab(user: ReturnType<typeof currentUser>) {
  if (!user) return HOME_TAB;
  const stored = user.defaultTab;
  return stored && allowedDefaultTabs(user).includes(stored)
    ? stored
    : HOME_TAB;
}
