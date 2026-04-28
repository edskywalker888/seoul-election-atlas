"use client";

import type { Party } from "@/types";
import { colorFor } from "@/lib/colorFor";
import { mixWithWhite, INTENSITY_RANGE } from "@/lib/colorIntensity";
import { formatPct } from "@/lib/format";

export interface PartyStats {
  partyId: string;
  party?: Party;
  count: number;
}

export interface TurnoutStats {
  min: number;
  median: number;
  max: number;
}

interface Props {
  partyStats: PartyStats[];
  turnoutStats: TurnoutStats | null;
  electionYear: string;
  filterPartyId: string | null;
  hoverPartyId: string | null;
  onFilter: (partyId: string | null) => void;
  onHover: (partyId: string | null) => void;
}

export function Legend({
  partyStats,
  turnoutStats,
  electionYear,
  filterPartyId,
  hoverPartyId,
  onFilter,
  onHover,
}: Props) {
  const active = hoverPartyId ?? filterPartyId;

  return (
    <div
      role="region"
      aria-label="Map legend"
      className="rounded-md border border-neutral-200 bg-white p-3"
    >
      <ul
        aria-label="Parties winning districts"
        className="flex flex-wrap gap-2"
      >
        {partyStats.map(({ partyId, party, count }) => {
          const isActive = active === partyId;
          const isFilter = filterPartyId === partyId;
          const displayName = party?.display_name_en ?? partyId;
          const nameKo = party?.display_name_ko;
          return (
            <li key={partyId}>
              <button
                type="button"
                onClick={() => onFilter(isFilter ? null : partyId)}
                onPointerEnter={() => onHover(partyId)}
                onPointerLeave={() => onHover(null)}
                onFocus={() => onHover(partyId)}
                onBlur={() => onHover(null)}
                aria-pressed={isFilter}
                className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 ${
                  isFilter
                    ? "border-neutral-900 bg-white"
                    : isActive
                      ? "border-neutral-400 bg-white"
                      : "border-neutral-200 bg-white hover:border-neutral-400"
                }`}
              >
                <span
                  className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: colorFor(party, electionYear) }}
                  aria-hidden="true"
                />
                <span className="text-neutral-900">{displayName}</span>
                {nameKo ? (
                  <span className="text-neutral-600" lang="ko">
                    {nameKo}
                  </span>
                ) : null}
                <span className="text-neutral-300">·</span>
                <span className="tabular-nums text-neutral-500">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {partyStats.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral-600">
            Winner vote share
          </p>
          <ul className="space-y-1.5 text-xs">
            {partyStats.map(({ partyId, party }) => {
              const base = colorFor(party, electionYear);
              const pale = mixWithWhite(base, 0.7);
              return (
                <li key={partyId} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 truncate text-neutral-700">
                    {party?.display_name_en ?? partyId}
                  </span>
                  <span
                    className="h-3 w-32 rounded-sm border border-neutral-200"
                    style={{
                      background: `linear-gradient(to right, ${pale}, ${base})`,
                    }}
                    aria-hidden="true"
                  />
                  <span className="font-mono tabular-nums text-neutral-600">
                    {INTENSITY_RANGE.palePct}%
                  </span>
                  <span className="text-neutral-400">→</span>
                  <span className="font-mono tabular-nums text-neutral-600">
                    {INTENSITY_RANGE.saturatePct}%+
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {turnoutStats ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span className="uppercase tracking-wide">Turnout</span>
          <span className="font-mono tabular-nums">
            min {formatPct(turnoutStats.min)}
          </span>
          <span className="font-mono tabular-nums">
            median {formatPct(turnoutStats.median)}
          </span>
          <span className="font-mono tabular-nums">
            max {formatPct(turnoutStats.max)}
          </span>
        </div>
      ) : null}

      {filterPartyId ? (
        <p className="mt-3 text-xs text-neutral-500">
          Filtered to{" "}
          {partyStats.find((p) => p.partyId === filterPartyId)?.party
            ?.display_name_en ?? filterPartyId}
          .{" "}
          <button
            type="button"
            onClick={() => onFilter(null)}
            className="underline underline-offset-2 hover:text-neutral-900"
          >
            Clear
          </button>
        </p>
      ) : null}
    </div>
  );
}
