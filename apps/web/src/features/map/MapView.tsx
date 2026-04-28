"use client";

import { useMemo, useState } from "react";
import type { DistrictResult, Party } from "@/types";
import type { DistrictBoundary } from "@/lib/loadBoundary";
import { MapCanvas } from "./MapCanvas";
import { Legend, type PartyStats, type TurnoutStats } from "./Legend";

interface Props {
  boundary: DistrictBoundary;
  resultsByDistrict: Record<string, DistrictResult>;
  parties: Record<string, Party>;
  electionYear: string;
  /**
   * Optional click navigation override. When set, clicking a gu navigates to
   * `/elections/<navigateToElectionId>?district=<id>` (used on the landing
   * map). Plain string so it can cross the server→client boundary.
   */
  navigateToElectionId?: string;
}

export function MapView({
  boundary,
  resultsByDistrict,
  parties,
  electionYear,
  navigateToElectionId,
}: Props) {
  const [filterPartyId, setFilterPartyId] = useState<string | null>(null);
  const [hoverPartyId, setHoverPartyId] = useState<string | null>(null);
  const activePartyId = hoverPartyId ?? filterPartyId;

  const partyStats = useMemo<PartyStats[]>(() => {
    const counts: Record<string, number> = {};
    for (const r of Object.values(resultsByDistrict)) {
      counts[r.winner_party_id] = (counts[r.winner_party_id] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([partyId, count]) => ({ partyId, party: parties[partyId], count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        const aName = a.party?.display_name_en ?? a.partyId;
        const bName = b.party?.display_name_en ?? b.partyId;
        return aName.localeCompare(bName);
      });
  }, [resultsByDistrict, parties]);

  const turnoutStats = useMemo<TurnoutStats | null>(() => {
    const values = Object.values(resultsByDistrict)
      .map((r) => r.turnout_pct)
      .sort((a, b) => a - b);
    if (values.length === 0) return null;
    return {
      min: values[0],
      median: values[Math.floor(values.length / 2)],
      max: values[values.length - 1],
    };
  }, [resultsByDistrict]);

  return (
    <div className="space-y-4">
      <div className="aspect-[4/3] overflow-hidden rounded-md border border-neutral-200 bg-white">
        <MapCanvas
          boundary={boundary}
          resultsByDistrict={resultsByDistrict}
          parties={parties}
          electionYear={electionYear}
          activePartyId={activePartyId}
          navigateToElectionId={navigateToElectionId}
        />
      </div>
      <Legend
        partyStats={partyStats}
        turnoutStats={turnoutStats}
        electionYear={electionYear}
        filterPartyId={filterPartyId}
        hoverPartyId={hoverPartyId}
        onFilter={setFilterPartyId}
        onHover={setHoverPartyId}
      />
    </div>
  );
}
