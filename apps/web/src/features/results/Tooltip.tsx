"use client";

import type { DistrictResult, Party } from "@/types";
import { colorFor } from "@/lib/colorFor";
import { formatPct } from "@/lib/format";

interface TooltipProps {
  districtId: string;
  districtNameKo?: string;
  districtNameEn?: string;
  result?: DistrictResult;
  parties: Record<string, Party>;
  electionYear: string;
  position: { x: number; y: number };
}

const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT_ESTIMATE = 180;
const CURSOR_OFFSET = 14;

export function Tooltip({
  districtId,
  districtNameKo,
  districtNameEn,
  result,
  parties,
  electionYear,
  position,
}: TooltipProps) {
  // Edge-flipping: anchor to cursor by default; flip to the other side if the
  // tooltip would overflow the viewport.
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 768;

  let x = position.x + CURSOR_OFFSET;
  let y = position.y + CURSOR_OFFSET;
  if (x + TOOLTIP_WIDTH > viewportW)
    x = position.x - TOOLTIP_WIDTH - CURSOR_OFFSET;
  if (y + TOOLTIP_HEIGHT_ESTIMATE > viewportH)
    y = position.y - TOOLTIP_HEIGHT_ESTIMATE - CURSOR_OFFSET;
  if (x < 0) x = CURSOR_OFFSET;
  if (y < 0) y = CURSOR_OFFSET;

  const topCandidates = result
    ? [...result.candidates].sort((a, b) => b.vote_pct - a.vote_pct).slice(0, 3)
    : [];
  const winnerParty = result ? parties[result.winner_party_id] : undefined;

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-md border border-neutral-200 bg-white p-3 shadow-md"
      style={{ left: x, top: y, width: TOOLTIP_WIDTH }}
    >
      <div className="text-sm font-semibold text-neutral-900" lang="ko">
        {districtNameKo ?? districtNameEn ?? districtId}
      </div>
      {districtNameEn && districtNameKo ? (
        <div className="text-xs text-neutral-500">{districtNameEn}</div>
      ) : null}

      {result ? (
        <>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: colorFor(winnerParty, electionYear) }}
              aria-hidden="true"
            />
            <span className="truncate text-sm font-medium text-neutral-900">
              {result.winner_candidate}
            </span>
            <span className="ml-auto shrink-0 text-xs text-neutral-500">
              {winnerParty?.display_name_en ?? result.winner_party_id}
            </span>
          </div>

          <ul className="mt-2 space-y-1 text-xs">
            {topCandidates.map((c) => {
              const party = parties[c.party_id];
              return (
                <li
                  key={`${c.name}-${c.party_id}`}
                  className="flex items-center gap-2"
                >
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: colorFor(party, electionYear) }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-neutral-700">{c.name}</span>
                  <span className="truncate text-neutral-600">
                    {party?.display_name_en ?? c.party_id}
                  </span>
                  <span className="ml-auto shrink-0 font-mono tabular-nums text-neutral-900">
                    {formatPct(c.vote_pct)}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs">
            <span className="text-neutral-500">Turnout</span>
            <span className="font-mono tabular-nums text-neutral-700">
              {formatPct(result.turnout_pct)}
            </span>
          </div>
        </>
      ) : (
        <div className="mt-2 text-xs text-neutral-500">No result data</div>
      )}
    </div>
  );
}
