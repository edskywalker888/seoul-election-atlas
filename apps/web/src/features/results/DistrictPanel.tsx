"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { DistrictResult, DistrictIssues, Party } from "@/types";
import { colorFor } from "@/lib/colorFor";
import { formatPct, formatVotes, formatMargin } from "@/lib/format";

interface Props {
  districtId: string;
  nameKo?: string;
  nameEn?: string;
  result?: DistrictResult;
  issues?: DistrictIssues | null;
  parties: Record<string, Party>;
  electionYear: string;
  electionId: string;
}

export function DistrictPanel({
  districtId,
  nameKo,
  nameEn,
  result,
  issues,
  parties,
  electionYear,
  electionId,
}: Props) {
  const router = useRouter();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const closeHref = `/elections/${electionId}`;

  // Esc closes; auto-focus the close button for keyboard-driven close.
  useEffect(() => {
    closeBtnRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        router.replace(closeHref, { scroll: false });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeHref, router]);

  const sortedCandidates = result
    ? [...result.candidates].sort((a, b) => b.vote_pct - a.vote_pct)
    : [];
  const winner = sortedCandidates[0];
  const runnerUp = sortedCandidates[1];
  const winnerParty = result ? parties[result.winner_party_id] : undefined;
  const margin =
    winner && runnerUp ? formatMargin(winner.vote_pct, runnerUp.vote_pct) : null;

  return (
    <section
      role="complementary"
      aria-label={`${nameKo ?? nameEn ?? districtId} details`}
      className="rounded-md border border-neutral-200 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            className="text-sm font-semibold text-neutral-900"
            lang="ko"
          >
            {nameKo ?? nameEn ?? districtId}
          </h2>
          {nameEn && nameKo ? (
            <p className="text-xs text-neutral-500">{nameEn}</p>
          ) : null}
        </div>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={() => router.replace(closeHref, { scroll: false })}
          aria-label="Close district details (Esc)"
          className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
        >
          ✕
        </button>
      </div>

      {result ? (
        <>
          {/* Hard election result block */}
          <div className="mt-4 rounded-md bg-neutral-50 p-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: colorFor(winnerParty, electionYear) }}
                aria-hidden="true"
              />
              <span className="truncate text-sm font-medium text-neutral-900">
                {result.winner_candidate}
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {winnerParty?.display_name_en ?? result.winner_party_id}
              {margin ? ` · ${margin} margin` : null}
            </p>

            <table className="mt-3 w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="py-1 font-medium">Candidate</th>
                  <th className="py-1 font-medium">Party</th>
                  <th className="py-1 text-right font-medium">Votes</th>
                  <th className="py-1 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {sortedCandidates.map((c) => {
                  const party = parties[c.party_id];
                  return (
                    <tr
                      key={`${c.name}-${c.party_id}`}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="py-1.5 pr-2 text-neutral-700">{c.name}</td>
                      <td className="py-1.5 pr-2 text-neutral-500">
                        <span
                          className="mr-1 inline-block h-2 w-2 rounded-sm align-middle"
                          style={{
                            backgroundColor: colorFor(party, electionYear),
                          }}
                          aria-hidden="true"
                        />
                        {party?.display_name_en ?? c.party_id}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums text-neutral-700">
                        {formatVotes(c.votes)}
                      </td>
                      <td className="py-1.5 text-right font-mono tabular-nums text-neutral-900">
                        {formatPct(c.vote_pct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-2 text-xs">
              <span className="text-neutral-500">Turnout</span>
              <span className="font-mono tabular-nums text-neutral-700">
                {formatPct(result.turnout_pct)}
              </span>
            </div>
          </div>

          {/* Interpretive block (distinct styling) */}
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              District drivers
            </h3>
            {issues ? (
              <>
                <p className="mt-2 text-xs text-neutral-700">
                  {issues.summary}
                </p>
                {issues.issues.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs">
                    {issues.issues.map((issue) => (
                      <li
                        key={issue.tag}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-neutral-600">{issue.label}</span>
                        <span className="font-mono tabular-nums text-neutral-600">
                          {issue.weight.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 text-xs text-neutral-600">
                  Confidence {issues.confidence.toFixed(2)}
                  {issues.source_ids.length > 0
                    ? ` · ${issues.source_ids.length} source${issues.source_ids.length === 1 ? "" : "s"}`
                    : null}
                </p>
                {issues.confidence < 0.65 ? (
                  <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                    Tentative — limited source support
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-xs text-neutral-500">Research pending.</p>
            )}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">
          No result data for this district.
        </p>
      )}
    </section>
  );
}
