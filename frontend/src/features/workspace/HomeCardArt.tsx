import type { ReactNode } from "react";

/** Small line drawings, one per screen, in the "Teknik Resim" manner. All share
 * a 240×72 sheet; classes colour them from the theme. */
const ART: Record<string, ReactNode> = {
  projects: (
    <>
      <rect className="art-fill" x="24" y="12" width="96" height="10" rx="1" />
      <rect className="art-fill" x="70" y="30" width="110" height="10" rx="1" />
      <rect className="art-fill" x="132" y="48" width="84" height="10" rx="1" />
      <path className="art-line" d="M120 17h8v18M180 35h8v18" />
      <path className="art-accent" d="M212 9l5 5-5 5-5-5z" />
      <path className="art-rule" d="M24 66h192" />
    </>
  ),
  plan: (
    <>
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 10 }, (_, col) => (
          <rect
            key={row + "-" + col}
            className={
              (row * 7 + col * 3) % 5 === 0
                ? "art-fill-strong"
                : (row + col) % 3 === 0
                  ? "art-fill"
                  : "art-cell"
            }
            x={22 + col * 20}
            y={8 + row * 15}
            width="17"
            height="12"
            rx="1"
          />
        )),
      )}
    </>
  ),
  progress: (
    <>
      <path className="art-rule" d="M20 62h200M20 10v52" />
      <path className="art-dash" d="M24 56L216 14" />
      <path className="art-line" d="M24 58C60 54 78 50 100 44S150 30 176 30" />
      <circle className="art-dot" cx="176" cy="30" r="3.5" />
    </>
  ),
  risk: (
    <>
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => (
          <rect
            key={row + "-" + col}
            className={
              col + (4 - row) >= 6
                ? "art-hot"
                : col + (4 - row) >= 4
                  ? "art-warm"
                  : "art-cell"
            }
            x={80 + col * 17}
            y={2 + row * 14}
            width="15"
            height="12"
            rx="1"
          />
        )),
      )}
      <circle className="art-dot" cx="148" cy="22" r="3.5" />
      <circle className="art-dot" cx="114" cy="36" r="3.5" />
    </>
  ),
  critical: (
    <>
      {[0, 1, 2].map((row) => (
        <g key={row} transform={`translate(30 ${10 + row * 19})`}>
          <rect className="art-cell" width="12" height="12" rx="1" />
          <rect
            className={row === 1 ? "art-accent-fill" : "art-fill"}
            x="22"
            y="3"
            width={[120, 96, 140][row]}
            height="6"
            rx="1"
          />
        </g>
      ))}
      <path className="art-line" d="M32 16l3 3 5-6M32 35l3 3 5-6" />
      <path className="art-accent" d="M190 26v14M190 26h12l-3 4 3 4h-12" />
    </>
  ),
  overview: (
    <>
      <path className="art-rule" d="M20 64h200" />
      {[22, 34, 18, 44, 30, 52, 26, 38, 20, 32].map((h, i) => (
        <rect
          key={i}
          className={i === 5 ? "art-accent-fill" : "art-fill"}
          x={28 + i * 19}
          y={64 - h}
          width="11"
          height={h}
          rx="1"
        />
      ))}
      <path className="art-dash" d="M20 32h200" />
    </>
  ),
  actual: (
    <>
      {Array.from({ length: 2 }, (_, row) =>
        Array.from({ length: 6 }, (_, col) => (
          <rect
            key={row + "-" + col}
            className={row === 1 && col === 3 ? "art-focus" : "art-cell"}
            x={36 + col * 29}
            y={14 + row * 24}
            width="25"
            height="18"
            rx="1"
          />
        )),
      )}
      <path className="art-line" d="M131 43v8" />
    </>
  ),
  activity: (
    <>
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 7 }, (_, col) => (
          <rect
            key={row + "-" + col}
            className={
              col > 4
                ? "art-soft"
                : (row * 7 + col) % 9 === 4
                  ? "art-accent-fill"
                  : (row * 7 + col) % 4 === 1
                    ? "art-fill"
                    : "art-cell"
            }
            x={64 + col * 16}
            y={6 + row * 16}
            width="13"
            height="13"
            rx="1"
          />
        )),
      )}
    </>
  ),
  resources: (
    <>
      <rect
        className="art-fill-strong"
        x="100"
        y="6"
        width="40"
        height="14"
        rx="1"
      />
      <path
        className="art-line"
        d="M120 20v10M60 30h120M60 30v8M120 30v8M180 30v8"
      />
      {[40, 100, 160].map((x) => (
        <rect
          key={x}
          className="art-fill"
          x={x}
          y="38"
          width="40"
          height="12"
          rx="1"
        />
      ))}
      <path className="art-rule" d="M60 50v8h-14M60 58h14M180 50v8h14" />
    </>
  ),
};

export default function HomeCardArt({ value }: { value: string }) {
  return (
    <span className="home-card-art" aria-hidden="true">
      <svg viewBox="0 0 240 72" preserveAspectRatio="xMidYMid meet">
        {ART[value]}
      </svg>
    </span>
  );
}

/** Bento rows on a three-column grid: rows of two (one card twice as wide,
 * alternating sides) and rows of three, always filling the last row. */
export function bentoSpans(count: number) {
  if (count <= 3) return Array<number>(count).fill(1);
  const spans: number[] = [];
  let left = count,
    pair = true,
    wideFirst = true;
  while (left > 0) {
    const take = left === 4 || left === 2 ? 2 : left === 3 ? 3 : pair ? 2 : 3;
    if (take === 2) {
      spans.push(...(wideFirst ? [2, 1] : [1, 2]));
      wideFirst = !wideFirst;
    } else spans.push(1, 1, 1);
    left -= take;
    pair = !pair;
  }
  return spans;
}
