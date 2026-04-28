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
    </section>
  );
}
