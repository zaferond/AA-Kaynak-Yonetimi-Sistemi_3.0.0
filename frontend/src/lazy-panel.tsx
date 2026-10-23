import {
  lazy,
  Suspense,
  useState,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";

const loaders: (() => Promise<unknown>)[] = [];

/** A screen kept out of the first download as its own chunk. Once
 * preloadPanels() has fetched it, it renders at once; opened earlier, it shows
 * a short status line until the chunk arrives. */
export function lazyPanel<C extends ComponentType<any>>(
  load: () => Promise<{ default: C }>,
  fallback: ReactNode = (
    <p className="panel-loading" role="status">
      Yükleniyor…
    </p>
  ),
) {
  let loaded: C | null = null;
  const fetch = () =>
    load().then((module) => {
      loaded = module.default;
      return module;
    });
  loaders.push(fetch);
  const Pending = lazy(fetch);
  return function LazyPanel(props: ComponentProps<C>) {
    // Chosen once per mount: switching from the suspended path to the direct
    // one later would remount the screen and lose its state.
    const [Ready] = useState(() => loaded);
    if (Ready) return <Ready {...props} />;
    return (
      <Suspense fallback={fallback}>
        <Pending {...props} />
      </Suspense>
    );
  };
}

/** Fetch every lazy screen in the background, after the workspace is shown. */
export function preloadPanels() {
  return Promise.all(loaders.map((load) => load().catch(() => {})));
}
