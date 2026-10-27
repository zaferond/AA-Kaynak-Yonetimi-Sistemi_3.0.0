/** Share one DB probe, including after its HTTP deadline, until it settles. */
export function createHealthCheck(
  store,
  { timeoutMs = 5000, cacheMs = 1000, now = () => performance.now() } = {},
) {
  let pending, cached;
  return () => {
    if (pending) return pending.response;
    if (cached && now() - cached.at < cacheMs)
      return Promise.resolve(cached.ok);
    const probe = {};
    pending = probe;
    // Normalize synchronous failures and observe late rejection after timeout.
    const work = Promise.resolve()
      .then(() => store.generation())
      .then(
        () => true,
        () => false,
      );
    let timer;
    probe.response = Promise.race([
      work,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
    work.then((ok) => {
      cached = { ok, at: now() };
      pending = undefined;
    });
    return probe.response;
  };
}
