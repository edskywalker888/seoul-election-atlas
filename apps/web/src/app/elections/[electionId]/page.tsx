import Link from "next/link";
import { notFound } from "next/navigation";
import { listElections, tryLoadElection } from "@/lib/loadElection";
import { loadElectionResults } from "@/lib/loadResults";
import {
  loadElectionIssues,
  loadAllDistrictIssues,
} from "@/lib/loadIssues";
import { loadParties } from "@/lib/loadParties";
import { loadBoundary } from "@/lib/loadBoundary";
import { listArticleTags } from "@/lib/loadArticle";
import { MapView } from "@/features/map/MapView";
import { ElectionIssuePanel } from "@/features/issues/ElectionIssuePanel";
import { DistrictPanel } from "@/features/results/DistrictPanel";

export async function generateStaticParams() {
  const elections = await listElections();
  return elections.map((e) => ({ electionId: e.election_id }));
}

export default async function ElectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ electionId: string }>;
  searchParams: Promise<{ district?: string }>;
}) {
  const { electionId } = await params;
  const { district: selectedDistrictId } = await searchParams;

  const election = await tryLoadElection(electionId);
  if (!election) notFound();

  const [
    results,
    electionIssues,
    districtIssuesByDistrict,
    parties,
    boundary,
    articleTagList,
  ] = await Promise.all([
    loadElectionResults(electionId),
    loadElectionIssues(electionId),
    loadAllDistrictIssues(electionId),
    loadParties(),
    loadBoundary(electionId),
    listArticleTags(electionId),
  ]);
  const articleTags = new Set(articleTagList);

  const resultsByDistrict = Object.fromEntries(
    results.map((r) => [r.district_id, r]),
  );
  const districtCount = results.length;
  const partyCount = Object.keys(parties).length;
  const districtIssueCount = Object.keys(districtIssuesByDistrict).length;
  const electionYear = election.date.slice(0, 4);

  const selectedFeature = selectedDistrictId
    ? boundary?.features.find(
        (f) => f.properties?.district_id === selectedDistrictId,
      )
    : undefined;
  const selectedResult = selectedDistrictId
    ? resultsByDistrict[selectedDistrictId]
    : undefined;
  const selectedIssues = selectedDistrictId
    ? (districtIssuesByDistrict[selectedDistrictId] ?? null)
    : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← All elections
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {election.name_en}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          <span lang="ko">{election.name_ko}</span> · {election.date} ·{" "}
          <span className="font-mono">{election.election_id}</span>
        </p>
      </header>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-label="Seoul district map and legend">
          {boundary ? (
            <MapView
              boundary={boundary}
              resultsByDistrict={resultsByDistrict}
              parties={parties}
              electionYear={electionYear}
            />
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white text-sm text-neutral-600">
              <span>No boundary data for this election yet</span>
              <span className="text-xs">
                expected at data/processed/boundaries/{electionId}/seoul.geojson
              </span>
            </div>
          )}
        </section>

        <aside>
          {selectedFeature && selectedDistrictId ? (
            <DistrictPanel
              districtId={selectedDistrictId}
              nameKo={selectedFeature.properties?.name_ko}
              nameEn={selectedFeature.properties?.name_en}
              result={selectedResult}
              issues={selectedIssues}
              parties={parties}
              electionYear={electionYear}
              electionId={electionId}
            />
          ) : (
            <ElectionIssuePanel
              issues={electionIssues}
              electionId={electionId}
              articleTags={articleTags}
            />
          )}
        </aside>
      </div>

      <footer className="mt-8 space-y-1 text-xs text-neutral-600">
        <p>
          {districtCount} district result{districtCount === 1 ? "" : "s"} ·{" "}
          {partyCount} part{partyCount === 1 ? "y" : "ies"} ·{" "}
          {districtIssueCount} district brief
          {districtIssueCount === 1 ? "" : "s"}
        </p>
        <p>
          Shown at 25 administrative gu. Each gu is represented by one NA
          sub-district's candidates; the 48-district view is out of scope. See
          Decisions.md (2026-04-23).
        </p>
      </footer>
    </main>
  );
}
