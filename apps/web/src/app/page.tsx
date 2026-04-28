import Link from "next/link";
import { tryLoadElection } from "@/lib/loadElection";
import { loadElectionResults } from "@/lib/loadResults";
import { loadParties } from "@/lib/loadParties";
import { loadBoundary } from "@/lib/loadBoundary";
import { loadLatestView } from "@/lib/loadSalience";
import { loadMarketEvent } from "@/lib/loadMarkets";
import { loadPollAggregate } from "@/lib/loadPolls";
import { MapView } from "@/features/map/MapView";
import { SalienceScorechart } from "@/features/salience/SalienceScorechart";
import { MarketsPanel } from "@/features/markets/MarketsPanel";

const FEATURED_ELECTION_ID = "na-2024-22";

const ELECTION_NAV = [
  { id: "na-2024-22", label: "22nd · 2024", populated: true },
  { id: "na-2020-21", label: "21st · 2020", populated: true },
  { id: "na-2016-20", label: "20th · 2016", populated: false },
  { id: "na-2012-19", label: "19th · 2012", populated: false },
  { id: "na-2008-18", label: "18th · 2008", populated: false },
  { id: "na-2004-17", label: "17th · 2004", populated: false },
  { id: "na-2000-16", label: "16th · 2000", populated: false },
  { id: "na-1996-15", label: "15th · 1996", populated: false },
];

export default async function Home() {
  const [
    featuredElection,
    featuredResults,
    parties,
    featuredBoundary,
    salienceView,
    marketsView,
    pollsAggregate,
  ] = await Promise.all([
    tryLoadElection(FEATURED_ELECTION_ID),
    loadElectionResults(FEATURED_ELECTION_ID),
    loadParties(),
    loadBoundary(FEATURED_ELECTION_ID),
    loadLatestView(),
    loadMarketEvent("2026-seoul-mayor"),
    loadPollAggregate("2026-seoul-mayor"),
  ]);

  const resultsByDistrict = Object.fromEntries(
    featuredResults.map((r) => [r.district_id, r]),
  );
  const featuredYear = featuredElection?.date.slice(0, 4) ?? "2024";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          Seoul Election Atlas
        </h1>
        <p className="mt-2 text-sm text-neutral-700">
          National Assembly outcomes across Seoul districts, with daily
          salience tracking of Korean political coverage.
        </p>
      </header>

      {featuredElection && featuredBoundary ? (
        <section className="mt-8" aria-label="Seoul district map">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-medium tracking-tight text-neutral-900">
                {featuredElection.name_en}
              </h2>
              <p className="mt-0.5 text-sm text-neutral-700">
                <span lang="ko">{featuredElection.name_ko}</span> ·{" "}
                {featuredElection.date} · click any gu to explore
              </p>
            </div>
            <Link
              href={`/elections/${FEATURED_ELECTION_ID}`}
              className="text-sm text-neutral-700 underline-offset-2 hover:text-blue-700 hover:underline"
            >
              Open full election view →
            </Link>
          </div>
          <div className="mt-4">
            <MapView
              boundary={featuredBoundary}
              resultsByDistrict={resultsByDistrict}
              parties={parties}
              electionYear={featuredYear}
              navigateToElectionId={FEATURED_ELECTION_ID}
            />
          </div>
        </section>
      ) : null}

      {marketsView.polymarket || marketsView.kalshi ? (
        <section className="mt-12" aria-label="Live prediction markets">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-medium tracking-tight text-neutral-900">
                Live prediction markets — Seoul Mayor 2026
              </h2>
              <p className="mt-0.5 text-sm text-neutral-700">
                June 3, 2026 (9th Local Elections). Solid line: market-implied
                probability of winning. Dashed line: polling support across Korean
                polling firms.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <MarketsPanel
              view={marketsView}
              parties={parties}
              polls={pollsAggregate}
            />
          </div>
          <p className="mt-3 text-xs text-neutral-700">
            Markets price <em>P(this candidate wins)</em>; polls measure{" "}
            <em>vote share</em>. Both bounded 0–1, but they're different
            quantities — gap between them is signal, not noise. When markets
            run far ahead of polls, they're pricing momentum or inside info.
            {pollsAggregate?.method === "manual_demo" ? (
              <>
                {" "}
                <span className="font-medium text-amber-800">
                  Polling line is hand-curated demo data
                </span>{" "}
                (NESDC has no public API; replace
                data/processed/polls/2026-seoul-mayor/aggregate.json with real
                numbers).
              </>
            ) : null}
          </p>
        </section>
      ) : null}

      {salienceView ? (
        <section className="mt-12" aria-label="Salience tracker">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-medium tracking-tight text-neutral-900">
                Today's political topics
              </h2>
              <p className="mt-0.5 text-sm text-neutral-700">
                Top-ranked Korean political stories, captured every 12 hours.
                Δ shows movement vs the previous capture.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <SalienceScorechart view={salienceView} />
          </div>
          <p className="mt-3 text-xs text-neutral-700">
            Salience reflects attention, not influence — a topic can dominate
            coverage without moving votes.
          </p>
        </section>
      ) : null}

      <section className="mt-12" aria-label="All elections">
        <h2 className="text-xl font-medium tracking-tight text-neutral-900">
          All elections
        </h2>
        <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
          {ELECTION_NAV.map((e) => (
            <li key={e.id}>
              {e.populated ? (
                <Link
                  href={`/elections/${e.id}`}
                  className="flex items-center justify-between py-3 text-neutral-900 hover:text-blue-700"
                >
                  <span>{e.label}</span>
                  <span className="text-xs text-neutral-600">{e.id}</span>
                </Link>
              ) : (
                <div className="flex items-center justify-between py-3 text-neutral-600">
                  <span>{e.label}</span>
                  <span className="text-xs">data pending</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-12 text-xs text-neutral-700">
        Shown at 25 Seoul administrative gu (자치구). Each gu is represented by
        one National Assembly sub-district per the aggregation rule in
        Decisions.md.
      </footer>
    </main>
  );
}
