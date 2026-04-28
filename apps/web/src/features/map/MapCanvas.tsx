"use client";

import { useMemo, useState } from "react";
import {
  useRouter,
  useSearchParams,
  usePathname,
} from "next/navigation";
import { geoMercator, geoPath } from "d3-geo";
import type { DistrictResult, Party } from "@/types";
import type { DistrictBoundary } from "@/lib/loadBoundary";
import { colorFor } from "@/lib/colorFor";
import { fillWithIntensity } from "@/lib/colorIntensity";
import { Tooltip } from "@/features/results/Tooltip";

interface Props {
  boundary: DistrictBoundary;
  resultsByDistrict: Record<string, DistrictResult>;
  parties: Record<string, Party>;
  electionYear: string;
  activePartyId?: string | null;
  /**
   * Override click navigation. If set, clicking a gu pushes to
   * `/elections/<navigateToElectionId>?district=<id>` (used on the landing
   * map). If omitted, clicking selects within the current page via
   * `?district=` (used inside an election route). Functions can't be passed
   * from server to client components, so this is a serializable string.
   */
  navigateToElectionId?: string;
  width?: number;
  height?: number;
}

interface HoveredState {
  districtId: string;
  nameKo?: string;
  nameEn?: string;
  position: { x: number; y: number };
}

export function MapCanvas({
  boundary,
  resultsByDistrict,
  parties,
  electionYear,
  activePartyId = null,
  navigateToElectionId,
  width = 800,
  height = 600,
}: Props) {
  const [hovered, setHovered] = useState<HoveredState | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // When the click is a navigation away (landing map), nothing on this page
  // is "selected" — skip the URL-derived highlight.
  const selectedDistrictId = navigateToElectionId
    ? null
    : searchParams.get("district");

  const paths = useMemo(() => {
    const projection = geoMercator().fitSize([width, height], boundary);
    const pathFn = geoPath(projection);
    return boundary.features
      .map((feature) => {
        const props = feature.properties;
        if (!props) return null;
        const d = pathFn(feature);
        if (!d) return null;
        return {
          id: props.district_id,
          nameKo: props.name_ko,
          nameEn: props.name_en,
          d,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [boundary, width, height]);

  const selectDistrict = (id: string) => {
    if (navigateToElectionId) {
      // External navigation (e.g., landing map → /elections/<id>?district=…).
      router.push(
        `/elections/${navigateToElectionId}?district=${id}`,
        { scroll: false },
      );
      return;
    }
    const params = new URLSearchParams(searchParams);
    params.set("district", id);
    // replace so rapid clicks don't pollute history; back exits the election.
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Seoul district map (gu-level)"
        className="h-full w-full"
      >
        {paths.map(({ id, nameKo, nameEn, d }) => {
          const result = resultsByDistrict[id];
          const winnerParty = result
            ? parties[result.winner_party_id]
            : undefined;
          const baseFill = colorFor(winnerParty, electionYear);
          // Margin-of-victory intensity: paler for close races, deeper for
          // landslides. Looks up the winner's vote_pct from the candidates list.
          const winnerVotePct = result?.candidates.find(
            (c) =>
              c.name === result.winner_candidate &&
              c.party_id === result.winner_party_id,
          )?.vote_pct;
          const fill = fillWithIntensity(baseFill, winnerVotePct);
          const label = nameKo ?? nameEn ?? id;
          const ariaLabel = result
            ? `${label}: winner ${result.winner_candidate} (${result.winner_party_id}), turnout ${result.turnout_pct.toFixed(2)} percent`
            : `${label}: no result`;
          const isHovered = hovered?.districtId === id;
          const isSelected = selectedDistrictId === id;
          const stroke = isSelected
            ? "#111111"
            : isHovered
              ? "#111111"
              : "#FFFFFF";
          const strokeWidth = isSelected ? 3 : isHovered ? 2 : 1;
          const dimmed =
            activePartyId != null &&
            (!result || result.winner_party_id !== activePartyId);
          const fillOpacity = dimmed ? 0.2 : 1;

          return (
            <path
              key={id}
              d={d}
              fill={fill}
              fillOpacity={fillOpacity}
              stroke={stroke}
              strokeWidth={strokeWidth}
              role="button"
              tabIndex={0}
              aria-label={ariaLabel}
              aria-pressed={isSelected}
              className="cursor-pointer outline-none transition-[stroke,stroke-width,fill-opacity] duration-150 motion-reduce:transition-none focus-visible:stroke-black"
              onPointerMove={(e) => {
                setHovered({
                  districtId: id,
                  nameKo,
                  nameEn,
                  position: { x: e.clientX, y: e.clientY },
                });
              }}
              onPointerLeave={() => setHovered(null)}
              onFocus={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHovered({
                  districtId: id,
                  nameKo,
                  nameEn,
                  position: { x: rect.right, y: rect.top },
                });
              }}
              onBlur={() => setHovered(null)}
              onClick={() => selectDistrict(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectDistrict(id);
                }
              }}
            />
          );
        })}
      </svg>

      {hovered ? (
        <Tooltip
          districtId={hovered.districtId}
          districtNameKo={hovered.nameKo}
          districtNameEn={hovered.nameEn}
          result={resultsByDistrict[hovered.districtId]}
          parties={parties}
          electionYear={electionYear}
          position={hovered.position}
        />
      ) : null}
    </div>
  );
}
