import { useState, type RefObject } from "react";

/** Dirty, saving or failed cells mark themselves `data-window-keep="true"`. */
export function hasOpenDraft(root: ParentNode | null | undefined) {
  return !!root?.querySelector('[data-window-keep="true"]');
}

/** Changing which rows render can unmount a dirty, pending or failed cell and
 * drop its unsaved draft. Every row-visibility control of a table goes
 * through `guard`, which refuses the change while such a cell exists. */
export function useViewChangeGuard(rootRef: RefObject<Element | null>) {
  const [error, setError] = useState("");
  function guard(view: string, apply: () => void) {
    if (hasOpenDraft(rootRef.current)) {
      setError(
        "Değişiklikleri kaydedin veya Escape ile iptal edin; ardından " +
          view +
          " görünümünü değiştirebilirsiniz.",
      );
      return;
    }
    setError("");
    apply();
  }
  return { error, guard };
}
