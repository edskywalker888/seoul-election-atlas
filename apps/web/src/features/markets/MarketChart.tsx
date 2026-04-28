import type {
  MarketCandidateHistory,
  Party,
  PollCandidate,
} from "@/types";
import { colorFor, familyFallback } from "@/lib/colorFor";

interface Props {
  candidates: MarketCandidateHistory[];
  parties: Record<string, Party>;
  /**
   * Optional polling overlay. When provided, each candidate matched by
   * Korean name (or English fallback) gets a dashed support-rate line
   * alongside the solid market line.
   */
  polls?: PollCandidate[];
  width?: number;
  height?: number;
  /** Show only the last N days. Defaults to all data. */
  lastDays?: number;
}

const PADDING = { top: 8, right: 12, bottom: 18, left: 28 };

function partyColor(
  partyId: string | undefined,
  parties: Record<string, Party>,
): string {
  if (!partyId) return familyFallback("independent");
  return colorFor(parties[partyId], "2026");
}

function formatMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCFullYear().toString().slice(2)}`;
}

export function MarketChart({
  candidates,
  parties,
  polls,
  width = 480,
  height = 180,
  lastDays,
}: Props) {
  if (candidates.length === 0 || candidates.every((c) => c.series.length < 2)) {
    return (
      <div className="flex h-44 items-center justify-center rounded-md bg-neutral-50 text-xs text-neutral-700">
        Not enough history yet — at least two captures needed.
      </div>
    );
  }

  // Optionally trim each candidate's series to the last N days.
  const cutoff = lastDays
    ? Date.now() - lastDays * 86400_000
    : -Infinity;
  const trimmed = candidates.map((c) => ({
    ...c,
    series: c.series.filter((p) => Date.parse(p.t) >= cutoff),
  }));

  // Match polls to market candidates by Korean name (canonical) or English.
  const pollByKey = new Map<string, PollCandidate>();
  if (polls) {
    for (const p of polls) {
      pollByKey.set(p.name_ko ?? p.name, p);
      pollByKey.set(p.name, p);
    }
  }
  const matchedPolls = trimmed.map((c) => {
    const key = c.name_ko ?? c.name;
    const poll = pollByKey.get(key) ?? pollByKey.get(c.name);
    if (!poll) return null;
    return {
      candidate: c,
      poll: {
        ...poll,
        series: poll.series.filter((p) => Date.parse(p.t) >= cutoff),
      },
    };
  });

  const allPoints = [
    ...trimmed.flatMap((c) => c.series),
    ...matchedPolls.flatMap((m) => m?.poll.series ?? []),
  ];
  const xValues = allPoints.map((p) => Date.parse(p.t));
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const xRange = Math.max(1, xMax - xMin);

  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  const xScale = (t: number) =>
    PADDING.left + ((t - xMin) / xRange) * innerW;
  const yScale = (p: number) => PADDING.top + (1 - p) * innerH;

  // Y-axis grid: 0, 25, 50, 75, 100
  const yGrid = [0, 0.25, 0.5, 0.75, 1];
  // X-axis tick months: pick ~4 evenly-spaced labels from the data range
  const xTicks = (() => {
    const months = new Set<string>();
    const stops: { x: number; label: string }[] = [];
    for (let i = 0; i <= 4; i++) {
      const t = xMin + (xRange * i) / 4;
      const label = formatMonth(new Date(t).toISOString());
      if (months.has(label)) continue;
      months.add(label);
      stops.push({ x: xScale(t), label });
    }
    return stops;
  })();

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Probability over time, line chart"
        className="h-44 w-full"
      >
        {/* Y-axis grid lines + labels */}
        {yGrid.map((p) => {
          const y = yScale(p);
          return (
            <g key={p}>
              <line
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={y}
                y2={y}
                stroke="#E5E5E5"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 4}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="#404040"
              >
                {Math.round(p * 100)}%
              </text>
            </g>
          );
        })}

        {/* X-axis tick labels */}
        {xTicks.map((tick, i) => (
          <text
            key={i}
            x={tick.x}
            y={height - 4}
            textAnchor="middle"
            fontSize={10}
            fill="#404040"
          >
            {tick.label}
          </text>
        ))}

        {/* Polling lines (dashed) — drawn first so market lines stack on top */}
        {matchedPolls.map((m, idx) => {
          if (!m || m.poll.series.length < 2) return null;
          const color = partyColor(m.candidate.party_id, parties);
          const d = m.poll.series
            .map((p, i) => {
              const x = xScale(Date.parse(p.t));
              const y = yScale(p.p);
              return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(" ");
          return (
            <path
              key={`poll-${idx}`}
              d={d}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.85}
            />
          );
        })}

        {/* Market lines (solid) — one per candidate */}
        {trimmed.map((c) => {
          if (c.series.length < 2) return null;
          const color = partyColor(c.party_id, parties);
          const d = c.series
            .map((p, i) => {
              const x = xScale(Date.parse(p.t));
              const y = yScale(p.p);
              return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(" ");
          const last = c.series[c.series.length - 1];
          const lastX = xScale(Date.parse(last.t));
          const lastY = yScale(last.p);
          return (
            <g key={c.market_id ?? c.name}>
              <path
                d={d}
                stroke={color}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={lastX} cy={lastY} r={3} fill={color} />
            </g>
          );
        })}
      </svg>

      {/* Solid-vs-dashed key */}
      {matchedPolls.some((m) => m && m.poll.series.length >= 2) ? (
        <div className="mt-2 flex items-center gap-4 text-[11px] text-neutral-600">
          <span className="flex items-center gap-1.5">
            <svg width="20" height="6" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="20"
                y2="3"
                stroke="#404040"
                strokeWidth="2"
              />
            </svg>
            market price
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="20" height="6" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="20"
                y2="3"
                stroke="#404040"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            </svg>
            poll support
          </span>
        </div>
      ) : null}

      {/* Per-candidate legend with current value */}
      <ul className="mt-2 space-y-1 text-xs">
        {trimmed.map((c, idx) => {
          const last = c.series[c.series.length - 1];
          const first = c.series[0];
          const color = partyColor(c.party_id, parties);
          const delta = last && first ? last.p - first.p : 0;
          const arrow = delta > 0.01 ? "▲" : delta < -0.01 ? "▼" : "—";
          const arrowClass =
            delta > 0.01
              ? "text-green-700"
              : delta < -0.01
                ? "text-red-700"
                : "text-neutral-600";
          const matched = matchedPolls[idx];
          const lastPoll = matched?.poll.series.length
            ? matched.poll.series[matched.poll.series.length - 1]
            : null;
          return (
            <li
              key={c.market_id ?? c.name}
              className="flex items-baseline gap-2"
            >
              <span
                className="inline-block h-2 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="font-medium text-neutral-900" lang="ko">
                {c.name_ko ?? c.name}
              </span>
              {c.name_ko ? (
                <span className="text-neutral-600">{c.name}</span>
              ) : null}
              <span className="ml-auto font-mono tabular-nums text-neutral-900">
                {(last.p * 100).toFixed(1)}%
              </span>
              <span
                className={`font-mono tabular-nums text-[11px] ${arrowClass}`}
                title={`market change since ${first.t.slice(0, 10)}`}
              >
                {arrow}
                {Math.abs(delta * 100).toFixed(0)}pp
              </span>
              {lastPoll ? (
                <span
                  className="font-mono tabular-nums text-[11px] text-neutral-600"
                  title={`Polling support, week ending ${lastPoll.t.slice(0, 10)}`}
                >
                  · poll {(lastPoll.p * 100).toFixed(0)}%
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
