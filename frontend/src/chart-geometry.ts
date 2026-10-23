/** Rounds the axis top to a 1–2–2,5–5 step so ticks read as whole numbers. */
export function niceScale(max: number, count = 4) {
  const raw = Math.max(max, 1e-9) / count;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const fraction = raw / power;
  const step =
    (fraction <= 1
      ? 1
      : fraction <= 2
        ? 2
        : fraction <= 2.5
          ? 2.5
          : fraction <= 5
            ? 5
            : 10) * power;
  const top = Math.max(step, Math.ceil(max / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(value);
  return { top, ticks };
}

type Point = { x: number; y: number };

/** Monotone cubic (Fritsch–Carlson) path: smooth, but never overshoots a month's value. */
export function smoothPath(points: Point[]) {
  if (!points.length) return "";
  if (points.length < 3)
    return points.map((p, i) => (i ? "L" : "M") + p.x + "," + p.y).join(" ");
  const h = points.slice(1).map((p, i) => p.x - points[i].x);
  const m = points.slice(1).map((p, i) => (p.y - points[i].y) / h[i]);
  const t = points.map((_, i) => {
    if (i === 0) return m[0];
    if (i === points.length - 1) return m[i - 1];
    if (m[i - 1] * m[i] <= 0) return 0;
    const w1 = 2 * h[i] + h[i - 1],
      w2 = h[i] + 2 * h[i - 1];
    return (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
  });
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1],
      dx = h[i] / 3;
    d += ` C${a.x + dx},${a.y + t[i] * dx} ${b.x - dx},${b.y - t[i + 1] * dx} ${b.x},${b.y}`;
  }
  return d;
}

/** Closes a line path down to the baseline so it can carry a soft area fill. */
export function areaPath(points: Point[], baseline: number) {
  if (points.length < 2) return "";
  return (
    smoothPath(points) +
    ` L${points[points.length - 1].x},${baseline} L${points[0].x},${baseline} Z`
  );
}
