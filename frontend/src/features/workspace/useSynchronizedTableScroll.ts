import { useEffect, type RefObject } from "react";
export function useSynchronizedTableScroll({
  enabled,
  primaryRef,
  secondaryRef,
  layoutKey,
}: {
  enabled: boolean;
  primaryRef: RefObject<HTMLTableElement | null>;
  secondaryRef: RefObject<HTMLTableElement | null>;
  layoutKey: string;
}) {
  useEffect(() => {
    if (!enabled) return;
    const primary = primaryRef.current?.parentElement,
      secondary = secondaryRef.current?.parentElement;
    if (!primary || !secondary) return;
    return synchronizeTableScroll(primary, secondary);
  }, [enabled, primaryRef, secondaryRef, layoutKey]);
}

export function synchronizeTableScroll(
  primary: HTMLElement,
  secondary: HTMLElement,
  frames = {
    request: (callback: FrameRequestCallback) =>
      requestAnimationFrame(callback),
    cancel: (id: number) => cancelAnimationFrame(id),
  },
) {
  let frame = 0;
  let source = primary;
  secondary.scrollLeft = primary.scrollLeft;
  const last = new Map([
    [primary, primary.scrollLeft],
    [secondary, secondary.scrollLeft],
  ]);
  const schedule = (element: HTMLElement) => {
    const left = element.scrollLeft;
    if (left === last.get(element)) return; // Ignore vertical and mirrored events.
    last.set(element, left);
    source = element;
    if (frame) return;
    frame = frames.request(() => {
      frame = 0;
      let target = source === primary ? secondary : primary;
      // A user can move the other table before its scroll event is delivered.
      // Do not overwrite that newer position with a pending resize/mirror frame.
      if (target.scrollLeft !== last.get(target)) {
        source = target;
        last.set(source, source.scrollLeft);
        target = source === primary ? secondary : primary;
      }
      if (Math.abs(target.scrollLeft - source.scrollLeft) > 0.5) {
        target.scrollLeft = source.scrollLeft;
        // Store the actual clamped position, so a shorter target cannot echo
        // its maximum back and interrupt the table the user is scrolling.
        last.set(target, target.scrollLeft);
      }
    });
  };
  const fromPrimary = () => schedule(primary),
    fromSecondary = () => schedule(secondary);
  primary.addEventListener("scroll", fromPrimary, { passive: true });
  secondary.addEventListener("scroll", fromSecondary, { passive: true });
  return () => {
    frames.cancel(frame);
    primary.removeEventListener("scroll", fromPrimary);
    secondary.removeEventListener("scroll", fromSecondary);
  };
}
