import type {
  MarketCandidate,
  MarketHistory,
  MarketSnapshot,
  MarketSource,
  Party,
  PollAggregate,
} from "@/types";
import type { MarketEventView } from "@/lib/loadMarkets";
import { colorFor, familyFallback } from "@/lib/colorFor";
import { MarketChart } from "./MarketChart";

const SOURCE_LABEL: Record<MarketSource, string> = {
  polymarket: "Polymarket",
  kalshi: "Kalshi",
};

function formatVolumeUsd(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

function formatProb(p: number): string {
  return `${(p * 100).toFixed(p < 0.01 ? 2 : 1)}%`;
}

function relativeTime(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  if (diffMs < 0) return "in the future";
  const m = Math.round(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function partyColor(
  partyId: string | undefined,
  parties: Record<string, Party>,
): string {
  if (!partyId) return familyFallback("independent");
  return colorFor(parties[partyId], "2026");
}

function CandidateRow({
  c,
  parties,
  prominent,
}: {
  c: MarketCandidate;
  parties: Record<string, Party>;
  prominent: boolean;
}) {
  const color = partyColor(c.party_id, parties);
  const pct = c.prob * 100;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 truncate">
          <span
            className={
              prominent
                ? "font-medium text-neutral-900"
                : "text-sm text-neutral-800"
            }
            lang="ko"
          >
            {c.name_ko ?? c.name}
          </span>
          {c.name_ko ? (
            <span className="ml-2 text-xs text-neutral-600">{c.name}</span>
          ) : null}
          {c.party_id ? (
            <span
              className="ml-2 inline-block rounded-sm px-1 py-0 text-[10px] font-medium uppercase tracking-wide text-neutral-800"
              style={{ backgroundColor: `${color}33` }}
            >
              {parties[c.party_id]?.display_name_en ?? c.party_id}
            </span>
          ) : null}
        </div>
        <span
          className={`shrink-0 font-mono tabular-nums ${prominent ? "text-base font-semibold text-neutral-900" : "text-xs text-neutral-700"}`}
        >
          {formatProb(c.prob)}
        </span>
      </div>
      <div
        className={`mt-1 overflow-hidden rounded-sm bg-neutral-100 ${prominent ? "h-3" : "h-1.5"}`}
      >
        <div
          className="h-full rounded-sm"
          style={{ width: `${pct}%`, backgroundColor: color }}
          aria-hidden="true"
        />
      </div>
    </li>
  );
}

function MarketCard({
  snapshot,
  history,
  polls,
  parties,
  now,
}: {
  snapshot: MarketSnapshot;
  history: MarketHistory | null;
  polls: PollAggregate | null;
  parties: Record<string, Party>;
  now: Date;
}) {
  const sorted = [...snapshot.candidates].sort((a, b) => b.prob - a.prob);
  const top = sorted.slice(0, 2);
  const rest = sorted.slice(2);

  // Restrict the chart to the same top candidates from the snapshot.
  // Match on Korean name (canonical) so Polymarket's "Chong Won-oh" and
  // Kalshi's "Chong Won-o" both find the same history series.
  const topKeys = new Set(top.map((c) => c.name_ko ?? c.name));
  const chartCandidates = (history?.candidates ?? []).filter((c) =>
    topKeys.has(c.name_ko ?? c.name),
  );

  return (
    <article className="rounded-md border border-neutral-200 bg-white p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-neutral-900">
          {SOURCE_LABEL[snapshot.source]}
        </h3>
        <p className="text-xs text-neutral-600">
          <span className="font-mono tabular-nums">
            {formatVolumeUsd(snapshot.total_volume_usd)}
          </span>{" "}
          vol · updated {relativeTime(snapshot.captured_at, now)}
        </p>
      </header>

      {chartCandidates.length > 0 ? (
        <div className="mt-3">
          <MarketChart
            candidates={chartCandidates}
            parties={parties}
            polls={polls?.candidates}
          />
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {top.map((c) => (
            <CandidateRow
              key={c.market_id ?? c.name}
              c={c}
              parties={parties}
              prominent={true}
            />
          ))}
        </ol>
      )}

      {rest.length > 0 ? (
        <details className="group mt-3 text-xs">
          <summary className="cursor-pointer list-none text-neutral-700 hover:text-neutral-900">
            <span className="group-open:hidden">
              + {rest.length} more candidate{rest.length === 1 ? "" : "s"} ·
              all under {formatProb(rest[0].prob)}
            </span>
            <span className="hidden group-open:inline">
              − collapse other candidates
            </span>
          </summary>
          <ol className="mt-3 space-y-2">
            {rest.map((c) => (
              <CandidateRow
                key={c.market_id ?? c.name}
                c={c}
                parties={parties}
                prominent={false}
              />
            ))}
          </ol>
        </details>
      ) : null}

      <a
        href={snapshot.event_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block text-xs text-neutral-700 underline-offset-2 hover:text-blue-700 hover:underline"
      >
        View on {SOURCE_LABEL[snapshot.source]} →
      </a>
    </article>
  );
}

// Match candidates across Polymarket and Kalshi by canonical Korean name
// (English fallback), then surface the per-candidate price gap. Gives a
// quick read on which contracts the two venues disagree on most — the
// raw input to any cross-venue arb thesis.
function CrossVenueGaps({
  polymarket,
  kalshi,
  parties,
}: {
  polymarket: MarketSnapshot;
  kalshi: MarketSnapshot;
  parties: Record<string, Party>;
}) {
  const kalshiByKey = new Map<string, MarketCandidate>();
  for (const c of kalshi.candidates) {
    kalshiByKey.set(c.name_ko ?? c.name, c);
    kalshiByKey.set(c.name, c);
  }

  const pairs = polymarket.candidates
    .map((p) => {
      const k =
        kalshiByKey.get(p.name_ko ?? p.name) ?? kalshiByKey.get(p.name);
      if (!k) return null;
      return {
        name: p.name,
        name_ko: p.name_ko,
        party_id: p.party_id ?? k.party_id,
        poly: p.prob,
        kalshi: k.prob,
        gap: p.prob - k.prob, // signed: + means Polymarket prices higher
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    // Drop sub-0.2pp gaps as noise from rounding / capture timing skew.
    .filter((x) => Math.abs(x.gap) >= 0.002)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  if (pairs.length === 0) return null;

  return (
    <section className="mt-4 rounded-md border border-neutral-200 bg-white p-4">
      <header>
        <h3 className="text-sm font-medium uppercase tracking-wide text-neutral-900">
          Cross-venue pricing gaps
        </h3>
        <p className="mt-1 text-xs text-neutral-700">
          Per-candidate difference in implied win probability between
          Polymarket and Kalshi for the same outcome. Larger gaps =
          more disagreement on the same underlying event.
        </p>
      </header>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
          <thead className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-600">
            <tr>
              <th className="py-2 pr-2 font-medium">Candidate</th>
              <th className="px-2 py-2 text-right font-medium">Polymarket</th>
              <th className="px-2 py-2 text-right font-medium">Kalshi</th>
              <th className="py-2 pl-2 text-right font-medium">Gap</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => {
              const color = partyColor(p.party_id, parties);
              const partyLabel = p.party_id
                ? parties[p.party_id]?.display_name_en ?? p.party_id
                : null;
              return (
                <tr
                  key={p.name_ko ?? p.name}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="py-2 pr-2">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span
                        className="font-medium text-neutral-900"
                        lang="ko"
                      >
                        {p.name_ko ?? p.name}
                      </span>
                      {p.name_ko ? (
                        <span className="hidden text-xs text-neutral-600 sm:inline">
                          {p.name}
                        </span>
                      ) : null}
                      {partyLabel ? (
                        <span className="hidden text-[10px] uppercase tracking-wide text-neutral-500 sm:inline">
                          {partyLabel}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-neutral-800">
                    {(p.poly * 100).toFixed(1)}%
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-neutral-800">
                    {(p.kalshi * 100).toFixed(1)}%
                  </td>
                  <td
                    className={`py-2 pl-2 text-right font-mono font-medium tabular-nums ${
                      p.gap >= 0 ? "text-blue-700" : "text-red-700"
                    }`}
                  >
                    {p.gap >= 0 ? "+" : ""}
                    {(p.gap * 100).toFixed(1)}pp
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-600">
        Positive (blue): Polymarket prices the candidate higher. Negative
        (red): Kalshi prices higher. Strict arb would short the higher venue
        and long the lower one — but {pairs.length === 1 ? "this gap" : "these gaps"}{" "}
        usually compress once fees, capital lockup, and venue access
        restrictions (Polymarket: no-US; Kalshi: US-only) are accounted for.
        Gaps under 0.2pp omitted as capture-timing noise.
      </p>
    </section>
  );
}

interface Props {
  view: MarketEventView;
  parties: Record<string, Party>;
  polls?: PollAggregate | null;
}

export function MarketsPanel({ view, parties, polls }: Props) {
  const now = new Date();
  const {
    polymarket,
    kalshi,
    polymarketHistory,
    kalshiHistory,
    consensusName,
    consensusSpread,
  } = view;

  if (!polymarket && !kalshi) return null;

  return (
    <section aria-label="Live prediction markets">
      {consensusName != null && consensusSpread != null ? (
        <div className="mb-3 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-700">
          {consensusSpread <= 0.05 ? (
            <>
              <span className="font-medium text-neutral-900">Consensus:</span>{" "}
              both markets favor{" "}
              <span className="font-medium text-neutral-900" lang="ko">
                {consensusName}
              </span>{" "}
              to win, within{" "}
              <span className="font-mono tabular-nums">
                {(consensusSpread * 100).toFixed(1)}pp
              </span>{" "}
              of each other.
            </>
          ) : (
            <>
              <span className="font-medium text-neutral-900">Divergence:</span>{" "}
              both pick{" "}
              <span className="font-medium text-neutral-900" lang="ko">
                {consensusName}
              </span>{" "}
              but disagree on conviction by{" "}
              <span className="font-mono tabular-nums">
                {(consensusSpread * 100).toFixed(1)}pp
              </span>
              .
            </>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {polymarket ? (
          <MarketCard
            snapshot={polymarket}
            history={polymarketHistory}
            polls={polls ?? null}
            parties={parties}
            now={now}
          />
        ) : null}
        {kalshi ? (
          <MarketCard
            snapshot={kalshi}
            history={kalshiHistory}
            polls={polls ?? null}
            parties={parties}
            now={now}
          />
        ) : null}
      </div>

      {polymarket && kalshi ? (
        <CrossVenueGaps
          polymarket={polymarket}
          kalshi={kalshi}
          parties={parties}
        />
      ) : null}
    </section>
  );
}
